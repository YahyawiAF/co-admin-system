import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import validator from 'validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export function IsEmailOrPhone(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isEmailOrPhone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          // Vérification email
          if (validator.isEmail(value)) return true;

          // Vérification téléphone
          try {
            const phoneNumber = parsePhoneNumberFromString(value, 'FR'); // 'FR' pour France
            return !!phoneNumber?.isValid();
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `Le format doit être : email (ex: user@mail.com) OU téléphone (ex: +33612345678 ou 0612345678)`;
        },
      },
    });
  };
}
