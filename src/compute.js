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

module.exports = {days, dayNumber, day};

module.exports.processWeight = (week, lift, trainingMax, kilos = true) => {
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
        (percent) => Math.round((trainingMax * percent) / (unt * 100)) * unt
      );
      const unit = kilos ? "kg" : "lbs";
      const msg = [
        `Today you are doing the ${lift} for: `,
        `${week === 1 ? "A rep" : week + " reps"} of ${weights[0]} ${unit}, `,
        `${week === 1 ? "A rep" : week + " reps"} of ${weights[1]} ${unit}, `,
        `More than ${week === 1 ? "a rep" : week + " reps"} of ${
          weights[2]
        } ${unit}, `,
        `5 sets of 5 reps of ${weights[3]} ${unit}`,
      ];
      return msg;
    }
  };
  
module.exports.repMax = (mass, reps) => Math.round((0.9 * mass * 36) / (37 - reps));
