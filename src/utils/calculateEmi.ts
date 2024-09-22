const payfreq: { [key: string]: number } = {
  Daily: 30,
  Weekly: 4,
  Monthly: 1,
  Yearly: 1 / 12,
};

export function calculateEmi(
  principal: number,
  rate: number,
  installments: number,
  interest_freq: string,
  installment_freq: string
) {
  // Get Monthly Payment
  // Then get actual Payment by dividing the montly payment with relative pay_frequency
  const monthly_payment = getMonthlyEMI(
    principal,
    rate,
    installments,
    interest_freq,
    installment_freq
  );

  const actual_emi = monthly_payment / payfreq[installment_freq];
  return actual_emi;
}

export function calculateEmiWithOverrode(
  principal: number,
  rate: number,
  preferred_installments: number,
  overrode_installments: number,
  interest_freq: string,
  installment_freq: string
) {
  const tenure_in_months = getTenureInMonths(
    overrode_installments,
    installment_freq
  );

  // Get Total Payable With the Preferred installment Value
  // But Divide The Amount Payable with the overrode Installments to get the
  // Desired the EMI by Admin
  const monthly_payment =
    getTotalPayable(
      principal,
      rate,
      preferred_installments,
      interest_freq,
      installment_freq
    ) / tenure_in_months;

  const actual_emi = monthly_payment / payfreq[installment_freq];
  return actual_emi;
}

export function getMonthlyEMI(
  principal: number,
  rate: number,
  tenure: number,
  interest_freq: string,
  installment_freq: string
) {
  const tenure_in_months = getTenureInMonths(tenure, installment_freq);

  // Get Monthly Payment By Dividing Total Payable Amount with tenure in months
  return (
    getTotalPayable(principal, rate, tenure, interest_freq, installment_freq) /
    tenure_in_months
  );
}

export function getTotalPayable(
  principal: number,
  rate: number,
  tenure: number,
  interest_freq: string,
  installment_freq: string
) {
  // Get Total Payable by adding Principle Amount With Total Interest
  return (
    principal +
    getTotalInterest(principal, rate, tenure, interest_freq, installment_freq)
  );
}

export function getTenureInMonths(tenure: number, installment_freq: string) {
  return tenure * (1 / payfreq[installment_freq]);
}

export function getTotalInterest(
  principal: number,
  rate: number,
  tenure: number,
  interest_freq: string,
  installment_freq: string
) {
  const rate_pm_in_perc = getRateInMonths(rate, interest_freq);
  const tenure_in_months = getTenureInMonths(tenure, installment_freq);
  return (principal * rate_pm_in_perc * tenure_in_months) / 100;
}

export function getRateInMonths(rate: number, interest_freq: string) {
  if (interest_freq !== "Monthly") {
    return rate / 12;
  }
  return rate;
}

// export const getTotalEmiPaid = (total_paid: number, emi_amount: number) => {
//   // devide total amount paid by emi_amount to get total emis paid.
//   return total_paid / emi_amount;
// };

// export const getRemainEmi = (
//   installments: number,
//   total_paid: number,
//   emi_amount: number
// ) => {
//   return installments - getTotalEmiPaid(total_paid, emi_amount);
// };

export const calculateInterest = (
  principal: number,
  rate_pa: number,
  tenure: number
) => {
  const rate_pm = getRateInMonths(rate_pa, "Yearly");

  return principal * (rate_pm / 100) * tenure;
};

export const calculateTotalReturn = (
  principal: number,
  rate_pa: number,
  tenure: number
) => {
  const interest = calculateInterest(principal, rate_pa, tenure);

  return principal + interest;
};
