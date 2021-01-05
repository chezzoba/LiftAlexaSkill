const AWS = require("aws-sdk");

const { dayNumber, day } = require('./compute');

const dynamodb = new AWS.DynamoDB.DocumentClient({ region: "us-east-1" });

export const get = async (number) => {
    const params = {
      Key: { phone: number },
      TableName: process.env.TABLE,
      AttributesToGet: [day, "week", "kilos", "ProgressDay"],
    };
  
    const lift = await dynamodb
      .get(params, (err, data) => {
        if (err) console.log(err, err.stack);
        else return data;
      })
      .promise();
  
    return lift.Item;
};
  
export const put = async (number, liftName, trainingMax, liftDay, kilos = true) => {
    const attr = liftName
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
    const entry = { lift: attr, mass: trainingMax, edited: dayNumber.getDate() };
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
  
export const updateWeek = async (number, neWeek) => {
    const params = {
      Key: { phone: number },
      TableName: process.env.TABLE,
      UpdateExpression: "set #a = :l, #b = :u",
      ExpressionAttributeNames: { "#a": "week", "#b": "ProgressDay" },
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