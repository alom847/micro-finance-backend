export const showAsCurrency = (amount: number) => {
  return Number(amount).toLocaleString("en-US", {
    style: "currency",
    currency: process.env.NEXT_PUBLIC_CURRENCY_ISO,
  });
};
