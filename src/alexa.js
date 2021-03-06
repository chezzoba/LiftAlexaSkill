const axios = require("axios");

const { dayNumber, days } = require('./compute');

exports.getNumber = async ({ apiAccessToken, apiEndpoint }) => {
    const { data, status } = await axios.get(
      apiEndpoint + "/v2/accounts/~current/settings/Profile.mobileNumber",
      { headers: { Authorization: "Bearer " + apiAccessToken } }
    );
    data.status = status;
    return data;
};
  
exports.getUserDay = async ({ apiAccessToken, apiEndpoint, device: { deviceId } }) => {
    var currentDateTime;
    try {
      const { data } = await axios.get(
        `${apiEndpoint}/v2/devices/${deviceId}/settings/System.timeZone`,
        { headers: { Authorization: "Bearer " + apiAccessToken } }
      );
      if (!data) currentDateTime = dayNumber;
      else currentDateTime = new Date(new Date().toLocaleString("en-US", 
      {timeZone: data}));
    } catch (err) {
      console.log(err);
      currentDateTime = dayNumber;
    }
    return days[currentDateTime.getDay()];
};