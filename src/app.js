const Alexa = require("ask-sdk-core");
const axios = require("axios");
const AWS = require("aws-sdk");

const smsRegions = ["us-east-2", "us-east-1", 
"us-west-1", "us-west-2", "ap-south-1", "ap-southeast-1", "ap-southeast-2", 
"ap-northeast-1", "ca-central-1", "eu-central-1", "eu-west-1", "eu-west-2", 
"eu-west-3", "eu-north-1", "me-south-1", "sa-east-1"];

const sns = new AWS.SNS({ 
  apiVersion: "2010-03-31", 
  region: smsRegions[Math.floor(Math.random() * smsRegions.length)] 
});

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: "us-east-1" });

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const dayNumber = new Date();

const day = days[dayNumber.getDay()];

const get = async (number) => {
  const params = {
    Key: { phone: number },
    TableName: process.env.TABLE,
    AttributesToGet: [day, "week", "kilos", 'ProgressDay'],
  };

  const lift = await dynamodb
    .get(params, (err, data) => {
      if (err) console.log(err, err.stack);
      else return data;
    })
    .promise();

  return lift.Item;
};

const put = async (number, liftName, trainingMax, liftDay, kilos = true) => {
  const attr = liftName
    .split(" ")
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
  const entry = {lift: attr, mass: trainingMax, edited: dayNumber.getDate()};
  const params = {
    Key: { phone: number },
    TableName: process.env.TABLE,
    UpdateExpression: "set #a = :l, #b = :k",
    ExpressionAttributeNames: { "#a": liftDay, "#b": "kilos" },
    ExpressionAttributeValues: { ":l": entry, ":k": kilos },
    ReturnValues: "UPDATED_NEW",
  };
  const res = await dynamodb
    .update(params, (err, data) => {
      if (err) console.log(err);
      else return data;
    })
    .promise();

  return res.Attributes;
};

const updateWeek = async (number, neWeek) => {
  const params = {
    Key: { phone: number },
    TableName: process.env.TABLE,
    UpdateExpression: "set #a = :l, #b = :u",
    ExpressionAttributeNames: { "#a": "week", "#b": "ProgressDay"},
    ExpressionAttributeValues: { ":l": neWeek, ":u": dayNumber.getDay() },
    ReturnValues: "UPDATED_NEW",
  };
  const res = await dynamodb
    .update(params, (err, data) => {
      if (err) console.log(err);
      else return data;
    })
    .promise();

  return res.Attributes;
};

const getNumber = async ({ apiAccessToken, apiEndpoint }) => {
  const { status, data } = await axios.get(
    apiEndpoint + "/v2/accounts/~current/settings/Profile.mobileNumber",
    { headers: { Authorization: "Bearer " + apiAccessToken } }
  );
  return status == 200 && data;
};

const processWeight = (week, lift, trainingMax, kilos = true) => {
  if (lift === "Rest") {
    return ["Today is your Rest Day!"];
  } else {
    const basePercent = week === 1 ? 75 : week === 3 ? 70 : 65;
    const unt = kilos ? 2.5 : 5;
    const percentages = [
      basePercent,
      basePercent + 10,
      basePercent + 20,
      basePercent,
    ];
    const weights = percentages.map(
      (percent) =>
        Math.round((trainingMax * percent ) / (unt * 100)) * unt
    );
    const unit = kilos ? "kilos" : "pounds";
    const msg = [
      `Today you are doing the ${lift} for: `,
      `${week === 1 ? "A rep" : week + " reps"} of ${weights[0]} ${unit}, `,
      `${week === 1 ? "A rep" : week + " reps"} of ${weights[1]} ${unit}, `,
      `More than ${week === 1 ? "A rep" : week + " reps"} of ${
        weights[2]
      } ${unit}, `,
      `5 sets of 5 reps of ${weights[3]} ${unit}`,
    ];
    return msg;
  }
};

const repMax = (mass, reps) => Math.round(0.9 * mass * 36 / (37 - reps));

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    const speakOutput = `Ask or tell me how much you have lifted. 
    You can also ask me to send you a message.`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
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
    const { confirmationStatus } = handlerInput.requestEnvelope.request.intent;
    try {
      const { phoneNumber, countryCode } = await getNumber(
        handlerInput.requestEnvelope.context.System
      );
      const number = `+${countryCode}${phoneNumber}`;
      const data = await get(number);
      if (!data) {
        return handlerInput.responseBuilder
          .speak(
            "You didn't tell me anything yet. Believe me I'd remember if you did."
          )
          .reprompt("So... This is getting awkward, huh?")
          .getResponse();
      }
      if (data.ProgressDay && data.ProgressDay === dayNumber.getDay()) {
        await updateWeek(number, data.week && data.week > 2 ? data.week - 2 : 5)
      }
      if (data[day].edited !== dayNumber.getDate()) {
        const progression = (data.kilos ? 1 : 2) * (data[day].lift === 'Deadlift' ? 2.5 : 1.25);
        await put(number, data[day].lift, data[day].mass + progression, day, data.kilos);
      }
      const msg = processWeight(parseInt(data.week), data[day].lift, data[day].mass, data.kilos);
      var outputText = msg.join("\n");
      if (confirmationStatus === "CONFIRMED") {
        const params = {
          PhoneNumber: number,
          Message: msg.join("\n"),
          MessageAttributes: {
            "AWS.SNS.SMS.SenderID": {
              DataType: "String",
              StringValue: "MyLifts",
            },
          },
        };

        await sns.publish(params, (err, data) => {
          if (err) console.log(err);
          else console.log(data);
        }).promise();

        outputText = "Alright! I texted you!";
      }
    } catch (err) {
      console.log(err);
      if ( err.response && [401, 403].includes(err.response.status) ) {
        return handlerInput.responseBuilder
          .speak(
            "You need to give me your number for this to work. Check your permissions."
          )
          .withAskForPermissionsConsentCard([
            "alexa::profile:mobile_number:read",
          ])
          .getResponse();
      } else outputText = "Something seems to have gone wrong.";
    }
    return handlerInput.responseBuilder
        .speak(outputText)
        .reprompt("Is there something else I can help you with?")
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
    const speakOutput =
      `Ask me 'How much should I lift today?' or tell me how much you did today.
      You can also ask me to send you a message.`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
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
    const speakOutput = "Goodbye!";

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
    const speakOutput = "Sorry, I don't seem to have understood what you have just said.";

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
    var speakOutput = "";

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

    const transform = { today: 0, yesterday: -1, tomorrow: 1 };
    const liftDay = slots.day in transform
      ? days[dayNumber.getDay() + transform[slots.day]]
      : days.includes(slots.day) ? slots.day : day;

    
    const kilos = slots.units !== "pounds";
    const trainingMax = repMax(slots.mass, slots.reps);


    try {
      const { phoneNumber, countryCode } = await getNumber(
        handlerInput.requestEnvelope.context.System
      );
      const number = `+${countryCode}${phoneNumber}`;

      await put(number, slots.lift, trainingMax, liftDay, kilos);

      if ( [1, 3, 5].includes(slots.reps) ) await updateWeek(number, slots.reps);

      speakOutput = `So I'm guessing your training max for the ${slots.lift} is about 
      ${trainingMax} ${kilos ? 'kilos' : 'pounds'} and your one rep max,
      ${Math.round(trainingMax / 0.9)} ${kilos ? 'kilos' : 'pounds'}.
      I'll remember this for next time.`;

    } catch (err) {
      console.log(err);
      if ( err.response && [401, 403].includes(err.response.status) ) {
        return handlerInput.responseBuilder
          .speak(
            "You need to give me your number for this to work. Check your permissions "
          )
          .withAskForPermissionsConsentCard([
            "alexa::profile:mobile_number:read",
          ])
          .getResponse();
      } else speakOutput = "I'm having a little trouble at the moment.";
    }

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
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


