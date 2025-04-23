import React, { useState } from "react";
import {
    Modal,
    Box,
    Typography,
    TextField,
    MenuItem,
    Button,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
} from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers";
import { format } from "date-fns";
import AddIcon from "@mui/icons-material/Add";
import { useCreateExpenseMutation } from "src/api/expenseApi";
import { ExpenseType } from "src/types/shared";

const style = {
    position: "absolute" as const,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 400,
    bgcolor: "background.paper",
    boxShadow: 24,
    p: 4,
    borderRadius: 2,
};

interface DailyExpenseModalProps {
    open: boolean;
    onClose: () => void;
    expenses: Array<{ id: string; name: string; amount: number; type: ExpenseType }>;
    onSubmit: (data: { expenseId: string; date?: string }) => void;
}

export default function DailyExpenseModal({
    open,
    onClose,
    expenses,
    onSubmit,
}: DailyExpenseModalProps) {
    const [selectedExpenseId, setSelectedExpenseId] = useState("");
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [openNewExpenseDialog, setOpenNewExpenseDialog] = useState(false);
    const [newExpense, setNewExpense] = useState({
        name: "",
        amount: 0,
        description: "",
    });

    const [createExpense] = useCreateExpenseMutation();

    // Filtrer les dépenses de type JOURNALIER
    const journalierExpenses = expenses.filter(expense => expense.type === "JOURNALIER");

    const handleCreateNewExpense = async () => {
        try {
            const createdExpense = await createExpense({
                name: newExpense.name,
                amount: newExpense.amount,
                type: "JOURNALIER" as ExpenseType,
                description: newExpense.description,
            }).unwrap();

            setSelectedExpenseId(createdExpense.id);
            setOpenNewExpenseDialog(false);
            setNewExpense({
                name: "",
                amount: 0,
                description: "",
            });
        } catch (error) {
            console.error("Failed to create expense:", error);
        }
    };

    const handleSubmit = () => {
        if (!selectedExpenseId) return;

        onSubmit({
            expenseId: selectedExpenseId,
            date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined,
        });
        onClose();
    };

    return (
        <>
            <Modal open={open} onClose={onClose}>
                <Box sx={style}>
                    <Typography variant="h6" mb={2}>
                        Add Daily Expense
                    </Typography>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                            select
                            fullWidth
                            label="Expense (Journalier)"
                            value={selectedExpenseId}
                            onChange={(e) => setSelectedExpenseId(e.target.value)}
                            margin="normal"
                            required
                        >
                            {journalierExpenses.map((expense) => (
                                <MenuItem key={expense.id} value={expense.id}>
                                    {expense.name} - {expense.amount} DT
                                </MenuItem>
                            ))}
                        </TextField>

                        <IconButton
                            sx={{
                                backgroundColor: 'primary.main',
                                color: 'white',
                                '&:hover': {
                                    backgroundColor: 'primary.dark',
                                },
                                borderRadius: '50%',
                                width: 30,
                                height: 30,
                                mt: 2
                            }}
                            onClick={() => setOpenNewExpenseDialog(true)}
                        >
                            <AddIcon />
                        </IconButton>
                    </Box>

                    <DatePicker
                        label="Date (optionnelle)"
                        value={selectedDate}
                        onChange={setSelectedDate}
                        slots={{ textField: TextField }}
                        slotProps={{ textField: { fullWidth: true, margin: "normal" } }}
                    />

                    <Stack direction="row" spacing={2} mt={3} justifyContent="flex-end">
                        <Button variant="outlined" onClick={onClose}>
                            Annuler
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleSubmit}
                            disabled={!selectedExpenseId}
                        >
                            Confirmer
                        </Button>
                    </Stack>
                </Box>
            </Modal>

            <Dialog
                open={openNewExpenseDialog}
                onClose={() => setOpenNewExpenseDialog(false)}
            >
                <DialogTitle>Create a new daily expense</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Nom"
                        fullWidth
                        value={newExpense.name}
                        onChange={(e) =>
                            setNewExpense({ ...newExpense, name: e.target.value })
                        }
                    />
                    <TextField
                        margin="dense"
                        label="Montant (DT)"
                        type="number"
                        fullWidth
                        value={newExpense.amount}
                        onChange={(e) =>
                            setNewExpense({ ...newExpense, amount: Number(e.target.value) })
                        }
                    />
                    <TextField
                        margin="dense"
                        label="Description"
                        fullWidth
                        multiline
                        rows={3}
                        value={newExpense.description}
                        onChange={(e) =>
                            setNewExpense({ ...newExpense, description: e.target.value })
                        }
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenNewExpenseDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreateNewExpense}>Confirm</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}