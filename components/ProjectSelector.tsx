import { useState } from "react";
import { Typography, Paper, Button, MenuItem, Select } from "@mui/material";

interface Project {
  id: number
  name: string
}

interface ProjectSelectorProps {
  projects: Project[]
  onSelect: (projectId: string | number) => void
}

export default function ProjectSelector({ projects, onSelect }: ProjectSelectorProps) {
  const [selected, setSelected] = useState<string | number>(projects[0]?.id ?? "");
  return (
    <Paper sx={{ p: 3, maxWidth: 400, mx: "auto", mt: 6 }}>
      <Typography variant="h6" mb={2}>Proje Seçimi</Typography>
      <Select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
      >
        {projects.map((p: Project) => (
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