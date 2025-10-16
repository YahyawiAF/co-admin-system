import React from "react";
import { Button, ButtonProps, IconButton, IconButtonProps, Tooltip } from "@mui/material";
import { usePermissions } from "src/hooks/usePermissions";

interface PermissionButtonProps extends ButtonProps {
  resource: string;
  action: string;
  tooltip?: string;
}

interface PermissionIconButtonProps extends IconButtonProps {
  resource: string;
  action: string;
  tooltip?: string;
}

/**
 * PermissionButton - Button that's only enabled if user has permission
 */
export const PermissionButton: React.FC<PermissionButtonProps> = ({
  resource,
  action,
  tooltip,
  children,
  ...props
}) => {
  const { hasPermission } = usePermissions();
  const allowed = hasPermission(resource, action);

  const button = (
    <Button {...props} disabled={!allowed || props.disabled}>
      {children}
    </Button>
  );

  if (!allowed && tooltip) {
    return (
      <Tooltip title={tooltip}>
        <span>{button}</span>
      </Tooltip>
    );
  }

  return button;
};

/**
 * PermissionIconButton - Icon button that's only enabled if user has permission
 */
export const PermissionIconButton: React.FC<PermissionIconButtonProps> = ({
  resource,
  action,
  tooltip,
  children,
  ...props
}) => {
  const { hasPermission } = usePermissions();
  const allowed = hasPermission(resource, action);

  const button = (
    <IconButton {...props} disabled={!allowed || props.disabled}>
      {children}
    </IconButton>
  );

  if (tooltip) {
    return (
      <Tooltip title={allowed ? tooltip : `No permission to ${action} ${resource}`}>
        <span>{button}</span>
      </Tooltip>
    );
  }

  return button;
};

export default PermissionButton;

