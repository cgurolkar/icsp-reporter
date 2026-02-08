import { useState } from "react";
import { Box, Typography, Paper, Button, MenuItem, Select } from "@mui/material";

export default function ProjectSelector({ projects, onSelect }) {
  const [selected, setSelected] = useState(projects[0]?.id || "");
  return (
    <Paper sx={{ p: 3, maxWidth: 400, mx: "auto", mt: 6 }}>
      <Typography variant="h6" mb={2}>Proje Seçimi</Typography>
      <Select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      >
        {projects.map(p => (
          <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
        ))}
      </Select>
      <Button
        variant="contained"
        fullWidth
        onClick={() => onSelect(selected)}
        disabled={!selected}
      >
        Projeye Gir
      </Button>
    </Paper>
  );
} 