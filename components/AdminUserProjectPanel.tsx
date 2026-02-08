import { Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Select, MenuItem } from "@mui/material";

interface User {
  id: number
  username: string
  role: string
  projects: number[]
}

interface Project {
  id: number
  name: string
}

interface AdminUserProjectPanelProps {
  users: User[]
  projects: Project[]
  onRoleChange: (userId: number, role: string) => void
  onProjectAssign: (userId: number, projectIds: number[]) => void
}

export default function AdminUserProjectPanel({ users, projects, onRoleChange, onProjectAssign }: AdminUserProjectPanelProps) {
  return (
    <Paper sx={{ p: 3, mt: 4, maxWidth: 900, mx: "auto" }}>
      <Typography variant="h6" mb={2}>Kullanıcı Yönetimi</Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Kullanıcı</TableCell>
            <TableCell>Rol</TableCell>
            <TableCell>Projeler</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user: User) => (
            <TableRow key={user.id}>
              <TableCell>{user.username}</TableCell>
              <TableCell>
                <Select
                  value={user.role}
                  onChange={e => onRoleChange(user.id, e.target.value)}
                  disabled={user.role === "admin"}
                  size="small"
                >
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="user">Kullanıcı</MenuItem>
                </Select>
              </TableCell>
              <TableCell>
                <Select
                  multiple
                  value={user.projects}
                  onChange={e => onProjectAssign(user.id, e.target.value as number[])}
                  renderValue={selected => selected.map((pid: number) => projects.find((p: Project) => p.id === pid)?.name).join(", ")}
                  size="small"
                  sx={{ minWidth: 200 }}
                >
                  {projects.map((p: Project) => (
                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                  ))}
                </Select>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
} 