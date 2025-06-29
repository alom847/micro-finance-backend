import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { due_record, loans, Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { DatabaseService } from "../database/database.service";
import { LoansService } from "src/loans/loans.service";

@Injectable()
export class UsersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createUserInput: Prisma.userCreateInput) {
    try {
      const user = await this.databaseService.user.create({
        data: {
          ...createUserInput,
          wallets: {
            create: {},
          },
        },
      });
      return { status: true, data: user };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        const constraint = e.meta.target; // Extract the constraint name

        if (constraint[0] === "phone") {
          throw new HttpException(
            "Phone is already in use.",
            HttpStatus.CONFLICT
          );
        } else if (constraint[0] === "email") {
          throw new HttpException(
            "Email is already in use.",
            HttpStatus.CONFLICT
          );
        }
      }

      throw new HttpException(
        "Something went wrong",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async findAll(userid: number, limit: number, skip: number) {
    const total = await this.databaseService.user.count();

    const users = await this.databaseService.user.findMany({
      orderBy: {
        created_at: "desc",
      },
      where: {
        id: {
          not: userid,
        },
        role: {
          notIn: ["Admin"],
        },
      },
      take: limit,
      skip: skip,
    });

    return {
      status: true,
      data: {
        users: users,
        total: total,
      },
    };
  }

  async findOneById(id: number) {
    const user = await this.databaseService.user.findFirst({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        image: true,
        father_name: true,
        mother_name: true,
        nominee_name: true,

        email: true,
        phone: true,
        alternate_phone: true,

        gender: true,
        date_of_birth: true,
        maritial_status: true,
        profession: true,
        annual_turnover: true,

        address: true,
        current_address: true,

        district: true,
        city: true,
        state: true,
        zip: true,

        current_district: true,
        current_city: true,
        current_state: true,
        current_zip: true,

        country: true,
        created_at: true,

        role: true,
        ac_status: true,
        kyc_verified: true,
        permissions: true,
      },
    });

    if (!user)
      throw new NotFoundException(`Can not find user with UserID ${id}`);

    return { status: true, data: user };
  }

  async findOneByPhone(phone: string) {
    const user = await this.databaseService.user.findFirst({
      where: {
        phone,
      },
      select: {
        id: true,
        password: true,
        phone: true,
        email: true,
        name: true,
        image: true,
        role: true,
        ac_status: true,
        kyc_verified: true,
        permissions: true,
      },
    });

    if (!user)
      return {
        status: false,
        message: `Can not find user with phone ${phone}`,
      };

    return { status: true, data: user };
  }

  async findOneByEmail(email: string) {
    const user = await this.databaseService.user.findFirst({
      where: {
        email,
      },
      select: {
        id: true,
        password: true,
        phone: true,
        email: true,
        name: true,
        image: true,
        role: true,
        ac_status: true,
        kyc_verified: true,
        permissions: true,
      },
    });

    if (!user)
      throw new NotFoundException(`Can not find user with email ${email}`);

    return { status: true, data: user };
  }

  async update(id: number, data: Prisma.userUpdateInput) {
    console.log(id);
    try {
      const updatedUser = await this.databaseService.user.update({
        where: {
          id,
        },
        data: {
          name: data.name,
          father_name: data.father_name,
          mother_name: data.mother_name,
          nominee_name: data.nominee_name,

          email: data.email,
          phone: data.phone,
          alternate_phone: data.alternate_phone,

          gender: data.gender,
          date_of_birth: data.date_of_birth,
          maritial_status: data.maritial_status,
          profession: data.profession,
          annual_turnover: data.annual_turnover
            ? Number(data.annual_turnover)
            : undefined,

          address: data.address,
          current_address: data.current_address,

          district: data.district,
          city: data.city,
          state: data.state,
          zip: data.zip,

          current_district: data.current_district,
          current_city: data.current_city,
          current_state: data.current_state,
          current_zip: data.current_zip,

          country: data.country,
        },
      });

      return { status: true, data: updatedUser };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        const constraint = e.meta.target; // Extract the constraint name

        if (constraint[0] === "username") {
          throw new HttpException(
            "Username is already taken",
            HttpStatus.CONFLICT
          );
        }

        if (constraint[0] === "phone") {
          throw new HttpException(
            "Phone number is already in use",
            HttpStatus.CONFLICT
          );
        }
      }

      throw new HttpException(
        "Something went wrong",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async updateProfilePic(id: number, img_url: string) {
    try {
      await this.databaseService.user.update({
        where: {
          id,
        },
        data: {
          image: img_url,
        },
      });

      return {
        status: true,
        message: "Success",
      };
    } catch (er) {
      throw new HttpException(
        "Something went wrong",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async findAssignments(
    userid: number,
    type: string,
    limit: number,
    skip: number,
    search: string
  ) {
    const search_term_string = (search as string)?.match(/^([A-Za-z\s]+)/gm);
    const search_term_number = (search as string)?.match(/\d*\d/gm);

    console.log(search_term_number);
    console.log(search_term_string);

    const orConditions: any[] = [];

    if (
      search_term_string &&
      ["hmr", "hmf", "hml"].includes(search_term_string[0].toLowerCase()) &&
      search_term_number
    ) {
      orConditions.push({
        id: parseInt(search_term_number[0]),
      });
    }

    if (
      search_term_string &&
      search_term_string[0].toLowerCase() === "hmu" &&
      search_term_number
    ) {
      orConditions.push({
        user_id: parseInt(search_term_number[0]),
      });
    }

    if (search) {
      orConditions.push({
        user: {
          OR: [
            {
              name: {
                contains: search,
              },
            },
            {
              phone: {
                contains: search,
              },
            },
          ],
        },
      });
    }

    if (type === "Deposit") {
      const assignment_records =
        await this.databaseService.assignments.findMany({
          where: {
            agent_id: userid,
            category: "Deposit",
          },
        });

      if (assignment_records.length > 0) {
        const assignments = assignment_records.map(
          (deposit) => deposit.plan_id
        );

        const deposits = await this.databaseService.deposits.findMany({
          orderBy: {
            deposit_date: "desc",
          },
          where: {
            id: {
              in: assignments,
            },
            deposit_status: "Active",
            ...(orConditions.length > 0 && { OR: orConditions }),
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                phone: true,
              },
            },
          },
          take: limit,
          skip: skip,
        });

        const total = await this.databaseService.deposits.count({
          where: {
            id: {
              in: assignments,
            },
            deposit_status: "Active",
            ...(orConditions.length > 0 && { OR: orConditions }),
          },
        });

        console.log(deposits.length);
        console.log(total);

        return {
          status: true,
          message: {
            deposits,
            total,
          },
        };
      }
    } else {
      const assignment_records =
        await this.databaseService.assignments.findMany({
          where: {
            agent_id: userid,
            category: "Loan",
          },
        });

      if (assignment_records.length > 0) {
        const assignments = assignment_records.map((loan) => loan.plan_id);

        const loans = await this.databaseService.loans.findMany({
          orderBy: {
            loan_date: "desc",
          },
          where: {
            id: {
              in: assignments,
            },
            loan_status: "Active",
            ...(orConditions.length > 0 && { OR: orConditions }),
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                phone: true,
              },
            },
          },
          take: limit,
          skip: skip,
        });

        const loansWithDues: (loans & {
          due: {
            overdues: due_record[];
            partiallyPaid: due_record[];
            dues: due_record[];
            totalOverdue: number;
            totalPartialRemain: number;
            totalDue: number;
          };
        })[] = [];

        for (const loan of loans) {
          const due = await this.getDue(loan.id);

          loansWithDues.push({
            ...loan,
            due,
          });
        }

        const total = await this.databaseService.loans.count({
          where: {
            id: {
              in: assignments,
            },
            loan_status: "Active",
            ...(orConditions.length > 0 && { OR: orConditions }),
          },
        });

        return {
          status: true,
          message: {
            loans: loansWithDues,
            total,
          },
        };
      }
    }
  }

  async remove(id: number) {
    await this.databaseService.user.delete({
      where: {
        id,
      },
    });

    return { status: true, data: `Deleted a user with UserID #${id}` };
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

  async findUserDetails(userid: number) {
    const user = await this.databaseService.user.findFirst({
      where: {
        id: userid,
      },
      include: {
        kyc_verifications: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    const loans = await this.databaseService.loans.count({
      where: {
        user_id: user?.id,
        loan_status: "Active",
      },
    });

    const loan_amount = await this.databaseService.loans.aggregate({
      where: {
        user_id: user?.id,
        loan_status: "Active",
      },
      _sum: {
        total_paid: true,
        total_payable: true,
      },
    });

    const deposits = await this.databaseService.deposits.count({
      where: {
        user_id: user?.id,
        deposit_status: "Active",
      },
    });

    const deposit_amount = await this.databaseService.deposits.aggregate({
      where: {
        user_id: user?.id,
        deposit_status: "Active",
      },
      _sum: {
        total_paid: true,
      },
    });

    return {
      status: true,
      data: {
        ...user,
        loans: loans,
        deposits: deposits,
        loan_amount:
          Number(loan_amount._sum.total_payable) -
          Number(loan_amount._sum.total_paid),
        deposit_amount: deposit_amount._sum.total_paid,
      },
    };
  }

  async updateUserByUserId(uid: number, data) {
    try {
      const updated_user = await this.databaseService.user.update({
        where: {
          id: uid,
        },
        data: {
          name: data.name,
          father_name: data.father_name,
          mother_name: data.mother_name,
          nominee_name: data.nominee_name,

          email: data.email,
          phone: data.phone,
          alternate_phone: data.alternate_phone,

          gender: data.gender,
          date_of_birth: data.date_of_birth,
          maritial_status: data.maritial_status,
          profession: data.profession,
          annual_turnover: data.annual_turnover,

          address: data.address,
          current_address: data.current_address,

          district: data.district,
          city: data.city,
          state: data.state,
          zip: data.zip,

          current_district: data.current_district,
          current_city: data.current_city,
          current_state: data.current_state,
          current_zip: data.current_zip,

          country: data.country,

          role: data.role,
          ac_status: data.ac_status,
        },
      });

      return {
        status: true,
        data: updated_user,
      };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError) {
        const constraint = e.meta.target; // Extract the constraint name

        if (constraint[0] === "username") {
          throw new HttpException(
            "Username is already taken",
            HttpStatus.CONFLICT
          );
        }

        if (constraint[0] === "phone") {
          throw new HttpException(
            "Phone number is already in use",
            HttpStatus.CONFLICT
          );
        }
      }

      throw new HttpException(
        "Something went wrong",
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
