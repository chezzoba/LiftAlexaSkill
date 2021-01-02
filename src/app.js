
const Alexa = require("ask-sdk-core");
const axios = require("axios");
const AWS = require("aws-sdk");

const sns = new AWS.SNS({ apiVersion: "2010-03-31" });
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: "us-east-1" });

const getDay = () => {
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
  return days[dayNumber.getDay()];
};

const day = getDay();

const get = async (number) => {
  const params = {
    Key: { phone: number },
    TableName: process.env.TABLE,
    AttributesToGet: [day, "week"],
  };

  const lift = await dynamodb
    .get(params, (err, data) => {
      if (err) console.log(err, err.stack);
      else return data;
    })
    .promise();

  return lift.Item;
};

const put = async (number, liftName, trainingMax) => {
  const entry = new Object();
  const attr = liftName
    .split(" ")
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
  entry[attr.join(" ")] = trainingMax;
  const params = {
    Key: { phone: number },
    TableName: process.env.TABLE,
    UpdateExpression: "set #a = :l, ",
    ExpressionAttributeNames: { "#a": day },
    ExpressionAttributeValues: { ":l": entry },
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
    UpdateExpression: "set #a = :l, ",
    ExpressionAttributeNames: { "#a": "week" },
    ExpressionAttributeValues: { ":l": neWeek },
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

const processWeight = (week, dayObject, kilos = true) => {
  const [lift, trainingMax] = Object.entries(dayObject)[0];
  if (lift === "Rest") {
    return ["Today is your Rest Day!"];
  } else {
    const basePercent = week === 1 ? 75 : week === 3 ? 70 : 65;
    const cvrt = kilos ? 1 : 2.20462262185;
    const unt = kilos ? 2.5 : 5;
    const percentages = [
      basePercent,
      basePercent + 10,
      basePercent + 20,
      basePercent,
    ];
    const weights = percentages.map(
      (percent) =>
        Math.round((trainingMax * percent * cvrt) / (unt * 100)) * unt
    );
    const unit = kilos ? "kilos" : "pounds";
    const msg = [
      `Today you are doing the ${lift} for: `,
      `${week === 1 ? "A" : week} rep${week === 1 ? "" : "s"} of ${
        weights[0]
      } ${unit}, `,
      `${week === 1 ? "A" : week} rep${week === 1 ? "" : "s"} of ${
        weights[1]
      } ${unit}, `,
      `More than ${week === 1 ? "a" : week} rep${week === 1 ? "" : "s"} of ${
        weights[2]
      } ${unit}, `,
      `5 sets of 5 reps of ${weights[3]} ${unit}`,
    ];
    return msg;
  }
};

const oneRepMax = (mass, reps) => Math.round(0.9 * mass * (1 + reps / 3));

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    const today = new Date();
    const time = today.getHours();
    const greeting =
      5 <= time < 12 ? "Morning" : 12 <= time < 17 ? "Afternoon" : "Evening";
    const speakOutput = `Good ${greeting}. Ask or tell me how much you lifted.`;

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
    try {
      const { phoneNumber, countryCode } = await getNumber(
        handlerInput.requestEnvelope.context.System
      );
      const number = `+${countryCode}${phoneNumber}`;
      const data = await get(number);
      if (!data) {
        return handlerInput.responseBuilder
          .speak(
            "You haven't told me anything yet. Believe me I'd remember if you did."
          )
          .getResponse();
      }
      const msg = processWeight(parseInt(data.week), data[day]);
      const params = {
        PhoneNumber: number,
        Message: msg.join("\n"),
        MessageAttributes: {
          "AWS.SNS.SMS.SenderID": {
            DataType: "String",
            StringValue: "MyLifts",
          }
        },
      };
      await sns.publish(params, (err, data) => {
        if (err) console.log(err);
        else console.log(data);
      }).promise();
      return handlerInput.responseBuilder
        .speak("Alright! I texted you!")
        .reprompt('Is there something else I can help you with?')
        .getResponse();
    } catch (err) {
      console.log(err);
      if (err.message.slice(-3) in ['401', '403']) {
        return handlerInput.responseBuilder
        .speak(
          "You need to give me your number for this to work. Check your permissions "
        )
        .withAskForPermissionsConsentCard(["alexa::profile:mobile_number:read"])
        .getResponse();
      }
    }
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
      "Ask me 'How much should I lift today?' or tell me how much you did today.";

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

const TellMeMyLiftIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "MyLiftIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput = "Goodbye!";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
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
    const speakOutput = "Sorry, I don't know about that. Please try again.";

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
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents
 * by defining them above, then also adding them to the request handler chain below
 * */
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
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below
 * */
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const speakOutput =
      "Sorry, I had trouble doing what you asked. Please try again.";
    console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

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
    TellMeMyLiftIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('LiftApp')
  .lambda();
