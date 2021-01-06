const AWS = require("aws-sdk");

const sns = new AWS.SNS({
  apiVersion: "2010-03-31",
  region: "us-east-1",
});

module.exports = async (message, { countryCode, phoneNumber }) => {
  const params = {
    PhoneNumber: `+${countryCode}${phoneNumber}`,
    Message: message,
    MessageAttributes: {
      "AWS.SNS.SMS.SenderID": {
        DataType: "String",
        StringValue: "MyLifts",
      },
    },
  };
  return await sns.publish(params, async (err, data) => {
    if (err) console.log(err);
    else return data;
  });
};
