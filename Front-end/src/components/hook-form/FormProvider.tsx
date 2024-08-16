import { FormProvider as Form } from "react-hook-form";
import { IFormProvider, MethodeType } from "../../types/hooksForm";
// ----------------------------------------------------------------------

import { FC } from "react";

const FormProvider: FC<IFormProvider<MethodeType>> = ({
  children,
  onSubmit,
  methods,
  styles,
}): JSX.Element => {
  return (
    <Form {...methods}>
      <form style={{ ...styles }} onSubmit={onSubmit}>
        {children}
      </form>
    </Form>
  );
};

export default FormProvider;
