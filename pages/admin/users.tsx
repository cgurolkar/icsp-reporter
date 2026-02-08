import AdminUserProjectPanel from "@/components/AdminUserProjectPanel";

// MOCK: API'den gelecek örnek kullanıcı ve projeler
const users = [
  { id: 1, username: "admin", role: "admin", projects: [1, 2] },
  { id: 2, username: "user1", role: "user", projects: [1] },
];
const projects = [
  { id: 1, name: "Proje A" },
  { id: 2, name: "Proje B" },
];

export default function AdminUsersPage() {
  const handleRoleChange = (userId: number, newRole: string) => {
    alert(`Kullanıcı ${userId} rolü değiştirildi: ${newRole}`);
    // API ile güncelleme yapılabilir
  };
  const handleProjectAssign = (userId: number, newProjects: number[]) => {
    alert(`Kullanıcı ${userId} projeleri: ${newProjects.join(", ")}`);
    // API ile güncelleme yapılabilir
  };

  return (
    <AdminUserProjectPanel
      users={users}
      projects={projects}
      onRoleChange={handleRoleChange}
      onProjectAssign={handleProjectAssign}
    />
  );
} 