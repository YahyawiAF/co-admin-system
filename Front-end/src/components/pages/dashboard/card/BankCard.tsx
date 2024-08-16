import styled from "@emotion/styled";
import {
  Box,
  CardContent,
  Grid,
  Card as MuiCard,
  Typography,
} from "@mui/material";
import { grey } from "@mui/material/colors";
import CreditCardIcon from "@mui/icons-material/CreditCard";
import Label from "src/components/label";
import { Card as CardType } from "src/types/shared";

const Card = styled(MuiCard)`
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  backdrop-filter: blur(4px);
  background: rgba(255, 255, 255, 0.2);
  box-shadow: 0px 0px 8px 2px rgba(0, 0, 0, 0.2);
  height: 100%;
`;

function CardBank({ card }: { card: CardType }) {
  const dateObject = new Date(card.expiry);

  const year = dateObject.getUTCFullYear();
  const month = ("0" + (dateObject.getUTCMonth() + 1)).slice(-2);
  const day = ("0" + dateObject.getUTCDate()).slice(-2);
  const hours = ("0" + dateObject.getUTCHours()).slice(-2);

  const formattedDate = `${year}-${month}-${day} ${hours}`;
  return (
    <Card>
      <CardContent sx={{ height: "100%" }}>
        <Grid sx={{ height: "100%" }} container spacing={4}>
          <Grid item xs={2} justifyContent={"center"} alignItems={"center"}>
            <Box
              sx={{
                border: "2px solid",
                borderRadius: "50%",
                padding: "20px",
                height: "20px",
                width: "20px",
                position: "relative",
              }}
            >
              <CreditCardIcon
                sx={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            </Box>
          </Grid>
          <Grid sx={{ height: "100%" }} item xs={10}>
            <Typography variant="h6" gutterBottom>
              XXXX-XXXX-XXXX-{card.cardNumberHidden}
            </Typography>
            <Label color="success">Verfied</Label>
            <Typography variant="body1" gutterBottom>
              {formattedDate}
            </Typography>
            <Typography fontSize={"12px"} color={grey[400]}>
              {card.address}
            </Typography>
            <Typography color={grey[800]} variant="h4">
              {card.name}
            </Typography>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default CardBank;
