import {
  Avatar as MuiAvatar,
  Box,
  Breadcrumbs as MuiBreadcrumbs,
  Button as MuiButton,
  Card as MuiCard,
  CardContent,
  Chip as MuiChip,
  Divider as MuiDivider,
  Grid as MuiGrid,
  LinearProgress as MuiLinearProgress,
  Typography as MuiTypography,
} from "@mui/material";
import { spacing, SpacingProps } from "@mui/system";
import styled from "@emotion/styled";

import { DollarSign } from "react-feather";
import { ReactNode } from "react";

const Breadcrumbs = styled(MuiBreadcrumbs)(spacing);

const Button = styled(MuiButton)(spacing);

const Card = styled(MuiCard)(spacing);

const Chip = styled(MuiChip)(spacing);

const Divider = styled(MuiDivider)(spacing);

const Grid = styled(MuiGrid)(spacing);

const LinearProgress = styled(MuiLinearProgress)(spacing);

const Spacer = styled.div(spacing);

interface TypographyProps extends SpacingProps {
  component?: string;
}
const Typography = styled(MuiTypography)<TypographyProps>(spacing);

const StatsIcon = styled.div`
  position: absolute;
  right: 16px;
  top: 32px;

  svg {
    width: 32px;
    height: 32px;
    color: ${(props) => props.theme.palette.secondary.main};
  }
`;

function Stats({
  title,
  count,
  icon,
}: {
  title: string;
  count: number;
  icon: ReactNode;
}) {
  return (
    <Box position="relative">
      <Card mb={6} pt={2}>
        <CardContent>
          <Typography variant="h2" gutterBottom>
            <Box fontWeight="fontWeightRegular">{count}</Box>
          </Typography>
          <Typography variant="body2" gutterBottom mt={3} mb={0}>
            {title}
          </Typography>

          <StatsIcon>{icon}</StatsIcon>
        </CardContent>
      </Card>
    </Box>
  );
}

export default Stats;
