const AWS = require("aws-sdk");

const smsRegions = [
  "us-east-2",
  "us-east-1",
  "us-west-1",
  "us-west-2",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "ca-central-1",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-west-3",
  "eu-north-1",
  "me-south-1",
  "sa-east-1",
];

const sns = new AWS.SNS({
  apiVersion: "2010-03-31",
  region: smsRegions[Math.floor(Math.random() * smsRegions.length)],
});

const send = async (message, { countryCode, phoneNumber }) => {
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

export default send