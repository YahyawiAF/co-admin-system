// import React, { useMemo } from "react";
// import styled from "@emotion/styled";
// import { withTheme } from "@emotion/react";
// import { Doughnut } from "react-chartjs-2";

// import { orange, grey, blue } from "@mui/material/colors";
// import {
//   Card as MuiCard,
//   CardContent,
//   Typography,
//   Grid,
//   Box,
//   Divider,
//   CardHeader,
//   IconButton,
//   Button as MuiButton,
// } from "@mui/material";
// import { spacing } from "@mui/system";
// import { MoreVertical } from "react-feather";
// import { ThemeProps } from "../../../../types/theme";
// import { useGetBalancesQuery } from "src/api";

// const Card = styled(MuiCard)(spacing);
// const Button = styled(MuiButton)(spacing);

// const ChartWrapper = styled.div`
//   height: 200px;
//   position: relative;
//   width: 100%;
// `;

// const DoughnutInner = styled.div`
//   width: 100%;
//   position: absolute;
//   top: 50%;
//   left: 0;
//   margin-top: -22px;
//   text-align: center;
//   z-index: 0;
// `;

// export type ThemePropsWithHeader = ThemeProps & {
//   header?: string;
// };

// const DoughnutChart = ({ theme, header }: ThemePropsWithHeader) => {
//   const { data: balance, isLoading, error } = useGetBalancesQuery();

//   const options = {
//     maintainAspectRatio: false,
//     plugins: {
//       legend: {
//         display: false,
//       },
//     },
//     cutout: "80%",
//     height: "auto",
//   };

//   const calculateOutstandingPercentage = useMemo(() => {
//     if (balance?.outstanding && balance?.credit_limit) {
//       const { outstanding, credit_limit } = balance;
//       let percentage = (outstanding / credit_limit) * 100;
//       return percentage;
//     } else return 0;
//   }, [balance]);

//   const data = {
//     labels: ["Available balance", "Monthly limit"],
//     datasets: [
//       {
//         data: [
//           calculateOutstandingPercentage,
//           100 - calculateOutstandingPercentage,
//         ],
//         backgroundColor: [
//           blue[900],
//           blue[300],
//           orange[500],
//           theme.palette.grey[200],
//         ],
//         borderWidth: 1,
//         borderColor: theme.palette.background.paper,
//       },
//     ],
//   };

//   return (
//     <Card style={{ flex: 1 }} mb={6}>
//       {header && (
//         <CardHeader
//           action={
//             <IconButton aria-label="settings" size="large">
//               <MoreVertical />
//             </IconButton>
//           }
//           title={header}
//         />
//       )}
//       <CardContent style={{ height: "100%" }}>
//         <Grid style={{ height: "100%" }} container display={"flex"}>
//           {!isLoading && (
//             <Grid
//               sx={{
//                 display: { lg: "flex", xs: "unset" },
//                 alignItems: { lg: "unset", xs: "center" },
//                 justifyContent: "center",
//                 flexDirection: "column",
//               }}
//               item
//               xs={12}
//               lg={6}
//             >
//               <Box>
//                 <Typography color={grey["800"]} variant="h4">
//                   Available balance
//                 </Typography>
//                 <Typography fontStyle="italic" variant="h3">
//                   <Box fontWeight="fontWeightBold">
//                     {balance?.outstanding} $
//                   </Box>
//                 </Typography>
//                 <Typography color={grey["700"]} variant="h5" mb={4}>
//                   <Box fontWeight="fontWeightRegular">
//                     {balance?.payment_date}
//                   </Box>
//                 </Typography>
//               </Box>
//               <Divider sx={{ borderBottomWidth: "2px" }} />
//               <Box mt={4}>
//                 <Typography color={grey["800"]} variant="h4">
//                   Monthly limit
//                 </Typography>
//                 <Typography variant="h3">
//                   <Box fontWeight="fontWeightBold">
//                     {balance?.credit_limit} $
//                   </Box>
//                 </Typography>
//               </Box>
//               <Box mt={3}>
//                 <Button mr={2} variant="contained" size="large" color="primary">
//                   Make a payment
//                 </Button>
//               </Box>
//             </Grid>
//           )}
//           <Grid
//             sx={{
//               height: "100%",
//               display: { lg: "flex", xs: "unset" },
//               justifyContent: "center",
//               alignItems: "center",
//             }}
//             item
//             xs={12}
//             lg={6}
//           >
//             <ChartWrapper>
//               <DoughnutInner>
//                 <Typography variant="h2">
//                   {calculateOutstandingPercentage}% left
//                 </Typography>
//               </DoughnutInner>
//               <Doughnut data={data} options={options} />
//             </ChartWrapper>
//           </Grid>
//         </Grid>
//       </CardContent>
//     </Card>
//   );
// };

// export default withTheme(DoughnutChart);
