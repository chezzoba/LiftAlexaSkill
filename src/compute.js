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
    const unt = kilos ? 2.5 : 5;
    const unit = kilos ? "kg" : "lbs";

    if (lift === "Rest") {
      return ["Actually, today is your Rest Day!"];
    } else if (lift === 'Deadlift') {
       return ['You can do the Deadlift for:',
        `3 sets of 5 reps of ${Math.round(trainingMax / unt) * unt} ${unit}`]
    } else {
      const basePercent = week === 1 ? 75 : week === 3 ? 70 : 65;
      const percentages = [
        basePercent,
        basePercent + 10,
        basePercent + 20,
        basePercent,
      ];
      const weights = percentages.map(
        (percent) => Math.round((trainingMax * percent) / (unt * 100)) * unt
      );
      return [ `You can do the ${lift} for: `,
        `${week === 1 ? "A rep" : week + " reps"} of ${weights[0]} ${unit}, `,
        `${week === 1 ? "A rep" : week + " reps"} of ${weights[1]} ${unit}, `,
        `More than ${week === 1 ? "a rep" : week + " reps"} of ${
          weights[2]
        } ${unit}, `,
        `5 sets of 5 reps of ${weights[3]} ${unit}`]
    }
  };
  
module.exports.repMax = (mass, reps) => Math.round((0.9 * mass * 36) / (37 - reps));
