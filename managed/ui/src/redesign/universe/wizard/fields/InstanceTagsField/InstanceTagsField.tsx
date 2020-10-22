import React, { FC } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { KeyValueInput } from '../../../../uikit/KeyValueInput/KeyValueInput';
import { InstanceConfigFormValue } from '../../steps/instance/InstanceConfig';
import { ControllerRenderProps } from '../../../../helpers/types';
import { FlagsObject } from '../../../../helpers/dtos';

export const InstanceTagsField: FC = () => {
  const { control } = useFormContext<InstanceConfigFormValue>();

  return (
    <Controller
      control={control}
      name="instanceTags"
      render={({ value, onChange }: ControllerRenderProps<FlagsObject>) => (
        <KeyValueInput value={value} onChange={onChange} disabled={false} />
      )}
    />
  );
};
