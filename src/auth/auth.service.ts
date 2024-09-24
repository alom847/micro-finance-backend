import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Response } from "express";
import { isEmail } from "class-validator";
import { Prisma, user } from "@prisma/client";

import * as CryptoJS from "crypto-js";

import { DatabaseService } from "../database/database.service";
import { UsersService } from "../users/users.service";
import {
  NotificationService,
  templates,
} from "../notification/notification.service";

// import { UserRegisteredEvent } from './events/userRegisteredEvent';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly usersService: UsersService,
    private readonly notificationService: NotificationService,
    private eventEmitter: EventEmitter2
  ) {}

  hash(password: string): string {
    const hashedPassword = CryptoJS.AES.encrypt(
      password,
      process.env.SALT as string
    ).toString();

    return hashedPassword;
  }

  compareHash(plainTextPassword: string, hashedPassword: string): boolean {
    console.log(plainTextPassword);
    console.log(hashedPassword);
    console.log(process.env.SALT);

    const decrypted_pass = CryptoJS.AES.decrypt(
      hashedPassword,
      process.env.SALT as string
    ).toString(CryptoJS.enc.Utf8);

    console.log(decrypted_pass);

    return plainTextPassword === decrypted_pass;
  }

  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit OTP
  }

  async signin(email: string, password: string, @Res() response: Response) {
    let user: Partial<user> = null;

    console.log(email, password);

    if (isEmail(email)) {
      const { data } = await this.usersService.findOneByEmail(email);
      user = data;
    } else {
      const { data } = await this.usersService.findOneByPhone(email);
      user = data;
    }

    console.log(user);

    if (!user) {
      const tempExist = await this.databaseService.otp.findMany({
        where: {
          identifier: email,
          verified: true,
          type: "Register",
        },
      });

      if (tempExist.length > 0) {
        throw new BadRequestException("Waiting For Account to be Verified!");
      }

      throw new UnauthorizedException("invalid credentials");
    }

    if (!this.compareHash(password, user.password)) {
      throw new UnauthorizedException("invalid credentials");
    }

    const payload = {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      image: user.image,
      role: user.role,
      ac_status: user.ac_status,
      kyc_verified: user.kyc_verified,
      permissions: user.permissions,
    };

    const access_token = await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
    });

    response.cookie("access_token", access_token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    return response.json({
      status: true,
      data: {
        token: access_token,
        user: payload,
      },
    });
  }

  async register(
    phone: string,
    email: string,
    password: string,
    confirm: string,
    name: string
  ) {
    const hashedPassword = this.hash(password);

    if (password != confirm) {
      throw new BadRequestException("Password mismatch");
    }

    const { status } = await this.usersService.findOneByPhone(phone);
    if (status) {
      throw new BadRequestException("You are already registered, Sign in.");
    }

    const otp = this.generateOTP();

    const hashedOTP = this.hash(otp);

    await this.databaseService.otp.deleteMany({
      where: {
        identifier: phone,
      },
    });

    await this.databaseService.otp.create({
      data: {
        identifier: phone,
        otp: hashedOTP,
        expirs_in: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        type: "Register",
        tmp_data: {
          phone,
          name,
          email,
          password: hashedPassword,
        },
      },
    });

    const resp = await this.notificationService.sendSMS(
      phone,
      templates.User_Create,
      [
        {
          Key: "otp",
          Value: otp,
        },
        {
          Key: "timeout",
          Value: "15",
        },
      ]
    );

    console.log(resp);

    return {
      status: true,
      data: {
        phone,
      },
    };
  }

  async validate(phone: string, otp: string, @Res() response: Response) {
    const signup_request = await this.databaseService.otp.findFirst({
      orderBy: {
        expirs_in: "desc",
      },
      where: {
        identifier: phone,
      },
    });

    if (!signup_request || new Date(signup_request.expirs_in) < new Date()) {
      throw new BadRequestException("OTP has expired");
    }

    if (!this.compareHash(otp, signup_request.otp)) {
      throw new BadRequestException("Provided OTP is incorrect.");
    }

    await this.databaseService.otp.updateMany({
      where: {
        id: signup_request.id,
      },
      data: {
        verified: true,
      },
    });

    return response.json({
      status: true,
      message: "Success! waiting for verification.",
    });

    // const registration_data = signup_request.tmp_data as Prisma.JsonObject;

    // const decrypted_password = CryptoJS.AES.decrypt(
    //   registration_data.password as string,
    //   process.env.SALT as string
    // ).toString(CryptoJS.enc.Utf8);

    // await this.databaseService.otp.deleteMany({
    //   where: {
    //     identifier: phone,
    //   },
    // });

    // const { data: user } = await this.usersService.create({
    //   phone: phone,
    //   email: registration_data?.email as string,
    //   password: registration_data?.password as string,
    //   name: registration_data?.name as string,
    // });

    // if (!user) {
    //   throw new InternalServerErrorException("Unable to create an account.");
    // }

    // this.notificationService.sendSMS(
    //   phone,
    //   templates.User_Create_Confirmation,
    //   [
    //     {
    //       Key: "customer",
    //       Value: registration_data?.name as string,
    //     },
    //     {
    //       Key: "password",
    //       Value: decrypted_password,
    //     },
    //     {
    //       Key: "username",
    //       Value: phone,
    //     },
    //   ]
    // );

    // let payload = {
    //   id: user.id,
    //   phone: user.phone,
    //   email: user.email,
    //   name: user.name,
    //   image: user.image,
    //   role: user.role,
    //   ac_status: user.ac_status,
    //   kyc_verified: user.kyc_verified,
    //   permissions: user.permissions,
    // };

    // const access_token = await this.jwtService.signAsync(payload, {
    //   secret: process.env.JWT_SECRET,
    // });

    // response.cookie("access_token", access_token, {
    //   httpOnly: true,
    //   secure: true,
    //   sameSite: "none",
    // });

    // return response.json({
    //   status: true,
    //   message: "success",
    //   data: {
    //     token: access_token,
    //     user: payload,
    //   },
    // });
  }

  async resetPwd(
    phone: string,
    otp: string,
    password: string,
    confirm: string
  ) {
    if (password != confirm) {
      throw new BadRequestException("Password mismatch");
    }

    const requestExists = await this.databaseService.otp.findFirst({
      orderBy: {
        expirs_in: "desc",
      },
      where: {
        identifier: phone,
        type: "ResetPassword",
      },
    });

    if (!requestExists) {
      throw new BadRequestException("can not find reset request!");
    }

    if (new Date(requestExists.expirs_in) < new Date(Date.now())) {
      throw new BadRequestException("reset request has been expired!");
    }

    if (!this.compareHash(otp, requestExists.otp)) {
      throw new BadRequestException("Provided OTP is incorrect.");
    }

    const hashedPassword = this.hash(password);

    const reset_password = this.databaseService.user.update({
      where: {
        phone: requestExists.identifier,
      },
      data: {
        password: hashedPassword,
      },
    });

    const delete_request = this.databaseService.otp.delete({
      where: {
        id: requestExists.id,
      },
    });

    await this.databaseService.$transaction([reset_password, delete_request]);

    return {
      status: true,
      message: "success",
    };
  }

  async reqPwdReset(phone: string) {
    const { status } = await this.usersService.findOneByPhone(phone);

    if (!status) {
      throw new BadRequestException(
        "can not find account associated with this phone."
      );
    }

    const otp = this.generateOTP();

    const hashedOtp = this.hash(otp);

    await this.databaseService.otp.create({
      data: {
        type: "ResetPassword",
        identifier: phone,
        otp: hashedOtp,
        expirs_in: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    await this.notificationService.sendSMS(phone, templates.Reset_Password, [
      {
        Key: "otp",
        Value: otp,
      },
      {
        Key: "timeout",
        Value: "15",
      },
    ]);

    return {
      status: true,
      data: {
        phone,
      },
    };
  }

  async resendOTP(identifier: string, type: string) {
    const otp = this.generateOTP();

    const hashedOTP = this.hash(otp);

    await this.databaseService.otp.updateMany({
      where: {
        identifier,
        type: type as "Register" | "ResetPassword",
      },
      data: {
        otp: hashedOTP,
        expirs_in: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      },
    });

    const resp = await this.notificationService.sendSMS(
      identifier,
      type === "Register" ? templates.User_Create : templates.Reset_Password,
      [
        {
          Key: "otp",
          Value: otp,
        },
        {
          Key: "timeout",
          Value: "15",
        },
      ]
    );

    return {
      status: true,
      data: {
        phone: identifier,
      },
    };
  }
}
