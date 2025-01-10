import {
  Box,
  Card as MuiCard,
  CardContent,
  Typography as MuiTypography,
} from "@mui/material";
import { spacing, SpacingProps } from "@mui/system";
import styled from "@emotion/styled";

import { ReactNode } from "react";

const Card = styled(MuiCard)(spacing);

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
