export const formatIndianPhoneNumber = (
  phoneNumber: string,
  withcode = true
) => {
  const pattern = /^(?:\+91|0|91)?([6789]\d{9})$/;
  const result = pattern.exec(phoneNumber);

  if (result) {
    return withcode ? "+91" + result[1] : result[1];
  } else {
    return "Invalid";
  }
};
