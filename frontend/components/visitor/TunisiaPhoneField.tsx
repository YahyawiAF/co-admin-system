"use client";

import PhoneInput from "react-phone-number-input";
import { isValidPhoneNumber } from "libphonenumber-js";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";

export function isTunisiaPhone(value?: string) {
  if (!value) return false;
  try {
    return isValidPhoneNumber(value, "TN");
  } catch {
    return false;
  }
}

export function TunisiaPhoneField({
  value,
  onChange,
  className,
}: {
  value?: string;
  onChange: (value?: string) => void;
  className?: string;
}) {
  return (
    <PhoneInput
      international
      defaultCountry="TN"
      countries={["TN"]}
      addInternationalOption={false}
      countryCallingCodeEditable={false}
      value={value}
      onChange={onChange}
      className={cn(
        "PhoneInput flex h-11 w-full items-center rounded-md border border-input bg-white px-3 text-sm",
        className
      )}
      numberInputProps={{
        className:
          "flex-1 border-0 bg-transparent outline-none placeholder:text-muted-foreground",
        placeholder: "20 123 456",
      }}
    />
  );
}
