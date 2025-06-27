import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import {
  deposits,
  due_record,
  kyc_verifications,
  loans,
  user,
} from "@prisma/client";
import { DatabaseService } from "../database/database.service";

@UseGuards(AuthGuard)
@Controller("search")
export class SearchController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get()
  async searchResult(
    @Req() req,
    @Query("filter") filter: string,
    @Query("src_term") src_term: string
  ) {
    const search_term_string = (src_term as string).match(/^([A-Za-z\s]+)/gm);
    const search_term_number = (src_term as string).match(/\d*\d/gm);

    let users: user[] = [];
    let loans: (loans & {
      due: {
        overdues: due_record[];
        partiallyPaid: due_record[];
        dues: due_record[];
        totalOverdue: number;
        totalPartialRemain: number;
        totalDue: number;
      };
    })[] = [];
    let deposits: deposits[] = [];
    let kycs: kyc_verifications[] = [];
    let loan_pendings: loans[] = [];
    let deposit_pendings: deposits[] = [];

    if (!["Admin", "Manager"].includes(req.user.role ?? "")) {
      if (req.user.role === "Agent") {
        if (filter === "Loans") {
          const assignment_records =
            await this.databaseService.assignments.findMany({
              where: {
                agent_id: req.user.id,
                category: "Loan",
              },
            });

          if (assignment_records.length > 0) {
            const assignments = assignment_records.map((loan) => loan.plan_id);

            const loansWithDues = await this.databaseService.loans.findMany({
              where: {
                id: {
                  in: assignments,
                },
                loan_status: "Active",
                OR: [
                  {
                    id: search_term_string
                      ? search_term_string[0].toLowerCase() === "hml"
                        ? search_term_number
                          ? parseInt(search_term_number[0])
                          : undefined
                        : undefined
                      : undefined,
                  },
                  {
                    user_id: search_term_string
                      ? search_term_string[0].toLowerCase() === "hmu"
                        ? search_term_number
                          ? parseInt(search_term_number[0])
                          : undefined
                        : undefined
                      : undefined,
                  },
                  {
                    user: {
                      OR: [
                        {
                          name: {
                            contains: src_term as string,
                          },
                        },
                        {
                          phone: {
                            contains: src_term as string,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
              include: {
                user: true,
              },
            });

            for (const loan of loansWithDues) {
              const due = await this.getDue(loan.id);

              loans.push({
                ...loan,
                due,
              });
            }
          }

          return {
            status: true,
            data: {
              loans,
            },
          };
        }

        if (filter === "Deposits") {
          const assignment_records =
            await this.databaseService.assignments.findMany({
              where: {
                agent_id: req.user.id,
                category: "Deposit",
              },
            });

          if (assignment_records.length > 0) {
            const assignments = assignment_records.map(
              (deposit) => deposit.plan_id
            );

            deposits = await this.databaseService.deposits.findMany({
              where: {
                id: {
                  in: assignments,
                },
                deposit_status: "Active",
                OR: [
                  {
                    id: search_term_string
                      ? ["hmr", "hmf"].includes(
                          search_term_string[0].toLowerCase()
                        )
                        ? search_term_number
                          ? parseInt(search_term_number[0])
                          : undefined
                        : undefined
                      : undefined,
                  },
                  {
                    user_id: search_term_string
                      ? search_term_string[0].toLowerCase() === "hmu"
                        ? search_term_number
                          ? parseInt(search_term_number[0])
                          : undefined
                        : undefined
                      : undefined,
                  },
                  {
                    user: {
                      OR: [
                        {
                          name: {
                            contains: src_term as string,
                          },
                        },
                        {
                          phone: {
                            contains: src_term as string,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
              include: {
                user: true,
              },
            });
          }

          return {
            status: true,
            data: {
              deposits,
            },
          };
        }
      }

      return {
        status: false,
        message: "Unauthorized",
      };
    }

    if (["All", "Users"].includes(filter as string)) {
      if (filter === "All" && !Boolean(src_term)) {
        users = [];
      } else {
        users = await this.databaseService.user.findMany({
          orderBy: {
            created_at: "desc",
          },
          where: {
            OR: [
              {
                id: search_term_string
                  ? search_term_string[0].toLowerCase() === "hmu"
                    ? search_term_number
                      ? parseInt(search_term_number[0])
                      : undefined
                    : undefined
                  : undefined,
              },
              {
                email: {
                  contains: src_term as string,
                },
              },
              {
                name: {
                  contains: src_term as string,
                },
              },
              {
                phone: {
                  contains: src_term as string,
                },
              },
            ],
          },
        });
      }
    }

    if (["All", "Loans"].includes(filter as string)) {
      if (filter === "All" && !Boolean(src_term)) {
        loans = [];
      } else {
        const loansWithoutDues = await this.databaseService.loans.findMany({
          orderBy: {
            created_at: "desc",
          },
          where: {
            loan_status: { in: ["Active", "Closed", "Settlement"] },
            OR: [
              {
                id: search_term_string
                  ? search_term_string[0].toLowerCase() === "hml"
                    ? search_term_number
                      ? parseInt(search_term_number[0])
                      : undefined
                    : undefined
                  : undefined,
              },
              {
                user_id: search_term_string
                  ? search_term_string[0].toLowerCase() === "hmu"
                    ? search_term_number
                      ? parseInt(search_term_number[0])
                      : undefined
                    : undefined
                  : undefined,
              },
              {
                user: {
                  OR: [
                    {
                      name: {
                        contains: src_term as string,
                      },
                    },
                    {
                      phone: {
                        contains: src_term as string,
                      },
                    },
                  ],
                },
              },
            ],
          },
          include: {
            user: true,
          },
        });

        for (const loan of loansWithoutDues) {
          const due = await this.getDue(loan.id);

          loans.push({
            ...loan,
            due,
          });
        }
      }
    }

    if (["All", "Deposits"].includes(filter as string)) {
      if (filter === "All" && !Boolean(src_term)) {
        deposits = [];
      } else {
        deposits = await this.databaseService.deposits.findMany({
          orderBy: {
            created_at: "desc",
          },
          where: {
            deposit_status: {
              in: ["Active", "Closed", "PrematureClosed", "Matured"],
            },
            OR: [
              {
                id: search_term_string
                  ? ["hmr", "hmf"].includes(search_term_string[0].toLowerCase())
                    ? search_term_number
                      ? parseInt(search_term_number[0])
                      : undefined
                    : undefined
                  : undefined,
              },
              {
                user_id: search_term_string
                  ? search_term_string[0].toLowerCase() === "hmu"
                    ? search_term_number
                      ? parseInt(search_term_number[0])
                      : undefined
                    : undefined
                  : undefined,
              },
              {
                user: {
                  OR: [
                    {
                      name: {
                        contains: src_term as string,
                      },
                    },
                    {
                      phone: {
                        contains: src_term as string,
                      },
                    },
                  ],
                },
              },
            ],
          },
          include: {
            user: true,
          },
        });
      }
    }

    if (["Kycs"].includes(filter as string)) {
      kycs = await this.databaseService.kyc_verifications.findMany({
        orderBy: {
          created_at: "desc",
        },
        where: {
          OR: [
            {
              user_id: search_term_string
                ? search_term_string[0].toLowerCase() === "hmu"
                  ? search_term_number
                    ? parseInt(search_term_number[0])
                    : undefined
                  : undefined
                : undefined,
            },
            {
              user: {
                OR: [
                  {
                    name: {
                      contains: src_term as string,
                    },
                  },
                  {
                    phone: {
                      contains: src_term as string,
                    },
                  },
                ],
              },
            },
          ],
        },
        include: {
          user: true,
        },
      });
    }

    if (
      [
        "Loans_Pending",
        "Loans_Active",
        "Loans_Closed",
        "Loans_Settlement",
      ].includes(filter as string)
    ) {
      const loansWithoutDues = await this.databaseService.loans.findMany({
        orderBy: {
          created_at: "desc",
        },
        where: {
          loan_status: filter.split("_")[1] as any,
          OR: [
            {
              id: search_term_string
                ? search_term_string[0].toLowerCase() === "hml"
                  ? search_term_number
                    ? parseInt(search_term_number[0])
                    : undefined
                  : undefined
                : undefined,
            },
            {
              user_id: search_term_string
                ? search_term_string[0].toLowerCase() === "hmu"
                  ? search_term_number
                    ? parseInt(search_term_number[0])
                    : undefined
                  : undefined
                : undefined,
            },
            {
              user: {
                OR: [
                  {
                    name: {
                      contains: src_term as string,
                    },
                  },
                  {
                    phone: {
                      contains: src_term as string,
                    },
                  },
                ],
              },
            },
          ],
        },
        include: {
          user: true,
        },
      });

      for (const loan of loansWithoutDues) {
        const due = await this.getDue(loan.id);

        loans.push({
          ...loan,
          due,
        });
      }
    }

    if (
      [
        "Deposits_Pending",
        "Deposits_Active",
        "Deposits_Matured",
        "Deposits_Closed",
        "Deposits_PrematureClosed",
      ].includes(filter as string)
    ) {
      deposits = await this.databaseService.deposits.findMany({
        orderBy: {
          created_at: "desc",
        },
        where: {
          deposit_status: filter.split("_")[1] as any,
          OR: [
            {
              id: search_term_string
                ? ["hmr", "hmf"].includes(search_term_string[0].toLowerCase())
                  ? search_term_number
                    ? parseInt(search_term_number[0])
                    : undefined
                  : undefined
                : undefined,
            },
            {
              user_id: search_term_string
                ? search_term_string[0].toLowerCase() === "hmu"
                  ? search_term_number
                    ? parseInt(search_term_number[0])
                    : undefined
                  : undefined
                : undefined,
            },
            {
              user: {
                OR: [
                  {
                    name: {
                      contains: src_term as string,
                    },
                  },
                  {
                    phone: {
                      contains: src_term as string,
                    },
                  },
                ],
              },
            },
          ],
        },
        include: {
          user: true,
        },
      });
    }

    return {
      status: true,
      data: {
        users,
        loans,
        deposits,
        kycs,
        loan_pendings,
        deposit_pendings,
      },
    };
  }

  async getDue(loan_id: number) {
    // const late_fee =
    //   Number(loan?.emi_amount) * (Number(loan?.loan_plan.penalty_rate) / 100);
    // const freq =
    //   payment_frequency[loan?.emi_frequency as loans_emi_frequency];

    const tommorow = new Date();
    tommorow.setHours(0, 0, 0);
    tommorow.setDate(tommorow.getDate() + 1);

    const [overdues, partiallyPaid, dues] = await Promise.all([
      this.databaseService.due_record.findMany({
        orderBy: { due_date: "desc" },
        where: {
          plan_id: loan_id,
          category: "Loan",
          status: "Overdue",
        },
      }),
      this.databaseService.due_record.findMany({
        orderBy: { due_date: "desc" },
        where: {
          plan_id: loan_id,
          category: "Loan",
          status: { in: ["PartiallyPaid", "PartiallyFeed"] },
          due_date: { lt: tommorow },
        },
      }),
      this.databaseService.due_record.findMany({
        orderBy: { due_date: "desc" },
        where: {
          plan_id: loan_id,
          category: "Loan",
          status: "Due",
          due_date: { lt: tommorow },
        },
      }),
    ]);

    // const updated_overdues = [];

    // for (let i = 0; i < overdues.length; i++) {
    //   const differenceInMilliseconds =
    //     new Date().getTime() - new Date(overdues[i].due_date).getTime();
    //   const differenceInDays = Math.floor(
    //     differenceInMilliseconds / (1000 * 60 * 60 * 24)
    //   );
    //   const estimated_fee = Math.floor(differenceInDays / freq) * late_fee;

    //   const updated_due = await this.databaseService.due_record.update({
    //     where: {
    //       id: overdues[i].id,
    //     },
    //     data: {
    //       late_fee: estimated_fee,
    //     },
    //   });

    //   updated_overdues.push(updated_due);
    // }

    // const updated_partial_dues = [];

    // for (let i = 0; i < partiallyPaid.length; i++) {
    //   const differenceInMilliseconds =
    //     new Date().getTime() - new Date(partiallyPaid[i].due_date).getTime();
    //   const differenceInDays = Math.floor(
    //     differenceInMilliseconds / (1000 * 60 * 60 * 24)
    //   );
    //   const estimated_fee = Math.floor(differenceInDays / freq) * late_fee;

    //   const updated_due = await this.databaseService.due_record.update({
    //     where: {
    //       id: partiallyPaid[i].id,
    //     },
    //     data: {
    //       late_fee: estimated_fee,
    //     },
    //   });

    //   updated_partial_dues.push(updated_due);
    // }

    // const overdueLateFee = updated_overdues.reduce((prv_due, cur_due) => {
    //   return prv_due + (Number(cur_due.late_fee) - Number(cur_due.paid_fee));
    // }, 0);

    // const partialLateFee = partiallyPaid.reduce((prv_due, cur_due) => {
    //   return prv_due + (Number(cur_due.late_fee) - Number(cur_due.paid_fee));
    // }, 0);

    // const totalLateFee = overdueLateFee + partialLateFee;

    // when late fee will be introduced use updated_overdues
    const totalOverdue = overdues.reduce(
      (total, due) => total + Number(due.emi_amount),
      0
    );
    // when late fee will be introduced use updated_partial_dues
    const totalPartialRemain = partiallyPaid.reduce(
      (total, due) =>
        total + (Number(due.emi_amount) - Number(due.paid_amount)),
      0
    );
    const totalDue = dues.reduce(
      (total, due) => total + Number(due.emi_amount),
      0
    );

    return {
      overdues: overdues, //updated_overdues,
      partiallyPaid: partiallyPaid, //updated_partial_dues,
      dues,
      totalOverdue,
      totalPartialRemain,
      totalDue,
    };
  }
}
