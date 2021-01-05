export const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  
export const dayNumber = new Date();
  
export const day = days[dayNumber.getDay()];

export const processWeight = (week, lift, trainingMax, kilos = true) => {
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
      const unit = kilos ? "kilos" : "pounds";
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
  
export const repMax = (mass, reps) => Math.round((0.9 * mass * 36) / (37 - reps));
