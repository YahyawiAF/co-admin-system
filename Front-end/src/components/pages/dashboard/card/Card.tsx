import styled from "@emotion/styled";
import {
  Avatar,
  Button as MuiButton,
  CardContent,
  Grid,
  Card as MuiCard,
  Typography,
} from "@mui/material";
import { green, grey, red } from "@mui/material/colors";
import { Box, spacing } from "@mui/system";
import { TaskAltOutlined, DoNotDisturb } from "@mui/icons-material";
import { useUpdateCardMutation } from "src/api";
import { Card as ICARD, StatusCard } from "src/types/shared";
const CardIcon = styled.div`
  width: 100px;
  height: 50px;
  font-family: "Share Tech Mono", monospace;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 0.5rem;
  backdrop-filter: blur(4px);
  background: #3f4040;
  box-shadow: 0px 0px 8px 2px rgba(0, 0, 0, 0.2);
  padding: 1rem;
  display: grid;
  grid-template-rows: repeat(4, 1fr);
  grid-row-gap: 0.5rem;
  grid-template-columns: repeat(4, 1fr);
  grid-column-gap: 0.35rem;
  position: relative;
`;
const Button = styled(MuiButton)(spacing);
const Card = styled(MuiCard)(spacing);

function CardBanner({ card }: { card: ICARD }) {
  const [updateCard] = useUpdateCardMutation();

  const onHandleUpdateCardAction = async (status: StatusCard) => {
    updateCard({ ...card, status });
  };

  return (
    <Card
      sx={{
        boxShadow:
          "inset 4px 0px 0px rgba(0, 0, 255, 0.4), 0px 4px 8px rgba(135, 206, 250, 0.4)",
      }}
      mb={6}
    >
      <CardContent>
        <Grid container spacing={4}>
          <Grid item xs={2} justifyContent={"center"} alignItems={"center"}>
            <CardIcon>
              <Avatar
                sx={{
                  width: "30px",
                  height: "30px",
                  position: "absolute",
                  right: 0,
                  bottom: "-11px",
                }}
                alt="profile_img"
                src="/static/img/avatars/avatar-1.jpg"
              />
            </CardIcon>
          </Grid>
          <Grid item xs={6}>
            <Grid justifyContent="space-between" container spacing={1}>
              <Grid item>
                <Typography variant="h6" gutterBottom>
                  {card.name} Request a new card
                </Typography>
                <Typography color={grey[400]} variant="subtitle1">
                  {card.address} | one time limite 1000£ |{" "}
                  {card.isPhysical ? "Physical" : "Virtual"}
                </Typography>
              </Grid>
            </Grid>
          </Grid>
          <Grid display={"flex"} alignItems={"center"} item xs={4}>
            <Grid display={"flex"} justifyContent={"flex-end"} container>
              <Grid
                display={"flex"}
                justifyContent={"center"}
                alignItems={"center"}
                item
              >
                <Button
                  mr={2}
                  startIcon={<DoNotDisturb />}
                  sx={{ color: red[500] }}
                  onClick={() => onHandleUpdateCardAction("unapproved")}
                >
                  Deny
                </Button>
                <Button
                  mr={2}
                  startIcon={<TaskAltOutlined />}
                  sx={{ color: green[500] }}
                  onClick={() => onHandleUpdateCardAction("approved")}
                >
                  Accept
                </Button>
                <Button mr={2} variant="outlined" color="secondary">
                  Secondary
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default CardBanner;
