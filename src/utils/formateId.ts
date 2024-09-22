export const formateId = (
  id: number,
  type: "User" | "Loan" | "FD" | "RD" | "WITHDRAWAL" = "User"
) => {
  switch (type) {
    case "User":
      return `${process.env.NEXT_PUBLIC_USER_PREFIX}${id
        .toString()
        .padStart(6, "0")}`;
    case "RD":
      return `${process.env.NEXT_PUBLIC_RD_PREFIX}${id
        .toString()
        .padStart(6, "0")}`;
    case "FD":
      return `${process.env.NEXT_PUBLIC_FD_PREFIX}${id
        .toString()
        .padStart(6, "0")}`;
    case "Loan":
      return `${process.env.NEXT_PUBLIC_LOAN_PREFIX}${id
        .toString()
        .padStart(6, "0")}`;
    case "WITHDRAWAL":
      return `${process.env.NEXT_PUBLIC_WITHDRAWAL_PREFIX}${id
        .toString()
        .padStart(2, "0")}`;
  }
};
