const Alexa = require("ask-sdk-core");

const { getNumber, getUserDay } = require("./alexa");
const send = require("./sns");
const { days, dayNumber, day, processWeight, repMax } = require("./compute");
const { get, put, updateWeek } = require("./db");

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    const speakOutput = `Ask or tell me how much you have lifted.`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(
        "Don't worry if you don't know what to say, sometimes I don't either. Try telling me how much you lifted today."
      )
      .getResponse();
  },
};

const PhoneMessageHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "MessagePhoneIntent"
    );
  },
  async handle(handlerInput) {
    const confirmed =
      handlerInput.requestEnvelope.request.intent.confirmationStatus ===
      "CONFIRMED";
    var numberData;
    if (confirmed) {
      try {
        numberData = await getNumber(
          handlerInput.requestEnvelope.context.System
        );
        if (numberData.status !== 200) {
          return handlerInput.responseBuilder
            .speak(
              `This is embarrassing but 
              I can't find your phone number.
              You can set it in your Amazon account 
              and then invoke the skill again after
              changing the permissions in the Alexa app.`
            )
            .withAskForPermissionsConsentCard([
              "alexa::profile:mobile_number:read",
            ])
            .withShouldEndSession(true)
            .getResponse();
        }
      } catch (err) {
        console.log(err);
        if (err.response && [401, 403].includes(err.response.status)) {
          return handlerInput.responseBuilder
            .speak(
              `In order to send text updates and reminders,
              Progress Tracker depends on your phone number. 
              Go to the home screen in your Alexa app and grant me permissions.`
            )
            .withAskForPermissionsConsentCard([
              "alexa::profile:mobile_number:read",
            ])
            .withShouldEndSession(true)
            .getResponse();
        } else {
          return handlerInput.responseBuilder
            .speak(
              "I'm sorry, it turns out I don't have my phone with me right now."
            )
            .withShouldEndSession(true)
            .getResponse();
        }
      }
    }
    const number = handlerInput.requestEnvelope.session.user.userId;
    const data = await get(number);
    if (!(data && data[day])) {
      return handlerInput.responseBuilder
        .speak(
          `You haven't told me how much you've lifted before.
          First tell me what you do on ${day}s,
          then ask me how much you can lift.`
        )
        .reprompt("So, this is getting awkward, huh?")
        .getResponse();
    } else if (data[day].edited !== dayNumber.getDate()) {
      const progression =
        (data.kilos ? 1 : 2) * (data[day].lift === "Deadlift" ? 2.5 : 1.25);
      await put(
        number,
        data[day].lift,
        data[day].mass + progression,
        day,
        data.kilos
      );
      if (data.ProgressDay && data.ProgressDay === dayNumber.getDay()) {
        await updateWeek(
          number,
          data.week && data.week > 2 ? data.week - 2 : 5
        );
      }
    }
    const msg = processWeight(
      parseInt(data.week),
      data[day].lift,
      data[day].mass,
      data.kilos
    );

    const outputText = msg.join("\n");

    if (confirmed && numberData) {
      await send(outputText, numberData);
      return handlerInput.responseBuilder
        .speak("Alright! I texted you!")
        .withShouldEndSession(true)
        .getResponse();
    }

    return handlerInput.responseBuilder
      .speak(outputText)
      .withSimpleCard("Today's Lifts", outputText)
      .withShouldEndSession(true)
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput = `Ask me 'How much should I lift today?' or tell me how much you did lift today.
      You can also ask me to send you a message or tell you how much to lift.
      Don't worry if you don't get me immediately. Nobody does.`;
    const cardContent = `Ask me:\n'How much should I lift today?'
or say:\n'I just lifted like 500 kilos today'.`;
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("Is there something else I can help you with?")
      .withSimpleCard("Don't Worry!", cardContent)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) ===
          "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    const speakOutput = "I bid you farewell!";

    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  },
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput =
      "Sorry, I don't seem to have understood what you have just said.";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const PutMyLiftIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "PutIntent"
    );
  },
  async handle(handlerInput) {
    const slots = new Object();
    const { confirmationStatus } = handlerInput.requestEnvelope.request.intent;
    Object.values(handlerInput.requestEnvelope.request.intent.slots).map(
      ({ resolutions, value, name }) => {
        slots[name] =
          (resolutions &&
            resolutions.resolutionsPerAuthority &&
            resolutions.resolutionsPerAuthority[0].values &&
            resolutions.resolutionsPerAuthority[0].values[0].value &&
            resolutions.resolutionsPerAuthority[0].values[0].value.name) ||
          (!isNaN(parseFloat(value)) ? parseFloat(value) : value);
      }
    );
    const kilos = slots.units !== "pounds";
    if (confirmationStatus !== "CONFIRMED") {
      const sayConfirm = `Okay let's just start from the beginning. 
      So if you did not do the 
      ${slots.mass} ${kilos ? "kilo" : "pound"} 
      ${slots.lift}, what did you do?`;

      return handlerInput.responseBuilder
        .speak(sayConfirm)
        .reprompt("Did you forget?")
        .getResponse();
    }

    const userDay = await getUserDay(
      handlerInput.requestEnvelope.context.System
    );
    const transform = { today: 0, yesterday: -1, tomorrow: 1 };
    const liftDay =
      slots.day in transform
        ? days[dayNumber.getDay() + transform[slots.day]]
        : days.includes(slots.day)
        ? slots.day
        : userDay;

    const trainingMax = repMax(slots.mass, slots.reps);

    const number = handlerInput.requestEnvelope.session.user.userId;

    await put(number, slots.lift, trainingMax, liftDay, kilos);

    if ([1, 3, 5].includes(slots.reps)) await updateWeek(number, slots.reps);

    const speakOutput = `So I'm guessing your training max for the ${
      slots.lift
    } is about 
      ${trainingMax} ${
      kilos ? "kilos" : "pounds"
    } and your one rep max is around
      ${Math.round(trainingMax / 0.9)} ${kilos ? "kilos" : "pounds"}.
      Don't worry, I'll remember this for next ${userDay}`;

    const cardContent = `Training Max: ${trainingMax} ${
      kilos ? "kg" : "lbs"
    }\nOne Rep Max: ${Math.round(trainingMax / 0.9)} ${kilos ? "kg" : "lbs"}`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .withSimpleCard(`Current Stats: ${slots.lift}`, cardContent)
      .withShouldEndSession(true)
      .getResponse();
  },
};

/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs
 * */
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    console.log(
      `~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`
    );
    // Any cleanup logic goes here.
    return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
  },
};

const IntentReflectorHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
    );
  },
  handle(handlerInput) {
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    const speakOutput = `You just triggered ${intentName}`;

    return (
      handlerInput.responseBuilder
        .speak(speakOutput)
        //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
        .getResponse()
    );
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const speakOutput =
      "I'm sorry, I don't feel too good about my answer. Please check on me later.";
    console.error(error.message);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom
 * */
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    PhoneMessageHandler,
    PutMyLiftIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent("LiftApp")
  .lambda();
