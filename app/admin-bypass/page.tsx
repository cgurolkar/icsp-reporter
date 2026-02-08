"use client"

import type React from "react"
import { useState, useEffect } from "react"
import {
  Container,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
} from "@mui/material"
import { Delete, Add, Edit, Home } from "@mui/icons-material"
import Link from "next/link"

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

function AdminPanelBypass() {
  const [tabValue, setTabValue] = useState(0)
  const [emails, setEmails] = useState<string[]>(["admin@company.com", "manager@company.com"])
  const [users, setUsers] = useState<string[]>(["admin", "manager"])
  const [customFields, setCustomFields] = useState<string[]>(["Extra Field 1", "Extra Field 2"])
  const [machines, setMachines] = useState<string[]>(["XCMG SR220", "SANY 285"])
  const [totalPiles, setTotalPiles] = useState<string>("100")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<"email" | "user" | "field" | "machine">("email")
  const [dialogValue, setDialogValue] = useState("")
  const [editIndex, setEditIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const loadSettings = async () => {
    setLoading(true)
    setError("")
    try {
      // Önce debug endpoint'ini test edelim
      const debugResponse = await fetch("/api/debug/admin-settings")
      if (debugResponse.ok) {
        const debugData = await debugResponse.json()
        console.log("Debug data:", debugData)
        
        if (debugData.success) {
          const settings = debugData.settings
          setEmails(settings.emails || ["admin@company.com", "manager@company.com"])
          setUsers(settings.users || ["admin", "manager"])
          setCustomFields(settings.customFields || ["Extra Field 1", "Extra Field 2"])
          setMachines(settings.machines || ["XCMG SR220", "SANY 285"])
          setTotalPiles(settings.totalPiles || "100")
        } else {
          // Debug başarısız olursa statik veriler kullan
          console.log("Using static data due to debug failure")
          setEmails(["admin@company.com", "manager@company.com"])
          setUsers(["admin", "manager"])
          setCustomFields(["Extra Field 1", "Extra Field 2"])
          setMachines(["XCMG SR220", "SANY 285"])
          setTotalPiles("100")
        }
      } else {
        // API çağrısı başarısız olursa statik veriler kullan
        console.log("Using static data due to API failure")
        setEmails(["admin@company.com", "manager@company.com"])
        setUsers(["admin", "manager"])
        setCustomFields(["Extra Field 1", "Extra Field 2"])
        setMachines(["XCMG SR220", "SANY 285"])
        setTotalPiles("100")
      }
    } catch (error) {
      console.error("Error loading settings:", error)
      // Hata durumunda da statik veriler kullan
      console.log("Using static data due to error")
      setEmails(["admin@company.com", "manager@company.com"])
      setUsers(["admin", "manager"])
      setCustomFields(["Extra Field 1", "Extra Field 2"])
      setMachines(["XCMG SR220", "SANY 285"])
      setTotalPiles("100")
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-site-id": "1" // Site ID'yi sabit olarak gönderiyoruz
        },
        body: JSON.stringify({
          emails: emails.filter((email) => email.trim() !== ""),
          users: users.filter((user) => user.trim() !== ""),
          customFields: customFields.filter((field) => field.trim() !== ""),
          machines: machines.filter((machine) => machine.trim() !== ""),
          totalPiles: totalPiles,
        }),
      })

      if (response.ok) {
        alert("Ayarlar kaydedildi!")
      } else {
        setError("Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      setError("Error saving settings")
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = (type: "email" | "user" | "field" | "machine") => {
    setDialogType(type)
    setDialogValue("")
    setEditIndex(-1)
    setDialogOpen(true)
  }

  const handleEdit = (type: "email" | "user" | "field" | "machine", index: number, value: string) => {
    setDialogType(type)
    setDialogValue(value)
    setEditIndex(index)
    setDialogOpen(true)
  }

  const handleDelete = (type: "email" | "user" | "field" | "machine", index: number) => {
    if (confirm("Silmek istediğinizden emin misiniz?")) {
      switch (type) {
        case "email":
          setEmails((prev) => prev.filter((_, i) => i !== index))
          break
        case "user":
          setUsers((prev) => prev.filter((_, i) => i !== index))
          break
        case "field":
          setCustomFields((prev) => prev.filter((_, i) => i !== index))
          break
        case "machine":
          setMachines((prev) => prev.filter((_, i) => i !== index))
          break
      }
    }
  }

  const handleDialogSave = () => {
    if (!dialogValue.trim()) {
      alert("Bu alan zorunludur")
      return
    }

    switch (dialogType) {
      case "email":
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(dialogValue)) {
          alert("Geçersiz email formatı")
          return
        }
        if (editIndex >= 0) {
          setEmails((prev) => prev.map((item, i) => (i === editIndex ? dialogValue.trim() : item)))
        } else {
          setEmails((prev) => [...prev, dialogValue.trim()])
        }
        break
      case "user":
        if (editIndex >= 0) {
          setUsers((prev) => prev.map((item, i) => (i === editIndex ? dialogValue.trim() : item)))
        } else {
          setUsers((prev) => [...prev, dialogValue.trim()])
        }
        break
      case "field":
        if (editIndex >= 0) {
          setCustomFields((prev) => prev.map((item, i) => (i === editIndex ? dialogValue.trim() : item)))
        } else {
          setCustomFields((prev) => [...prev, dialogValue.trim()])
        }
        break
      case "machine":
        if (editIndex >= 0) {
          setMachines((prev) => prev.map((item, i) => (i === editIndex ? dialogValue.trim() : item)))
        } else {
          setMachines((prev) => [...prev, dialogValue.trim()])
        }
        break
    }
    setDialogOpen(false)
  }

  const getDialogTitle = () => {
    switch (dialogType) {
      case "email":
        return editIndex >= 0 ? "Email Düzenle" : "Email Ekle"
      case "user":
        return editIndex >= 0 ? "Kullanıcı Düzenle" : "Kullanıcı Ekle"
      case "field":
        return editIndex >= 0 ? "Alan Düzenle" : "Alan Ekle"
      case "machine":
        return editIndex >= 0 ? "Makine Düzenle" : "Makine Ekle"
      default:
        return ""
    }
  }

  const getPlaceholder = () => {
    switch (dialogType) {
      case "email":
        return "ornek@email.com"
      case "user":
        return "Kullanıcı adı"
      case "field":
        return "Alan adı"
      case "machine":
        return "XCMG SR220"
      default:
        return ""
    }
  }

  useEffect(() => {
    loadSettings()
  }, [])

  return (
    <Container
      maxWidth="lg"
      sx={{ py: 4, minHeight: "100vh", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
    >
      <Paper
        elevation={3}
        sx={{ p: 4, borderRadius: 3, background: "rgba(255, 255, 255, 0.95)", backdropFilter: "blur(10px)" }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
          <Typography variant="h4" component="h1" sx={{ color: "primary.main", fontWeight: 700 }}>
            Admin Panel (Bypass)
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Link href="/" passHref>
              <IconButton
                sx={{
                  backgroundColor: "primary.main",
                  color: "white",
                  "&:hover": {
                    backgroundColor: "primary.dark",
                  },
                }}
                title="Ana Sayfa"
              >
                <Home />
              </IconButton>
            </Link>
          </Box>
        </Box>

        {error && (
          <Box sx={{ mb: 2, p: 2, backgroundColor: "error.light", color: "error.contrastText", borderRadius: 1 }}>
            <Typography>{error}</Typography>
          </Box>
        )}

        <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
            <Tab label="Email Ayarları" />
            <Tab label="Kullanıcı Yönetimi" />
            <Tab label="Özel Alanlar" />
            <Tab label="Makine Yönetimi" />
            <Tab label="Proje Ayarları" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Email Alıcıları</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd("email")}>
              Email Ekle
            </Button>
          </Box>
          <List>
            {emails.map((email, index) => (
              <ListItem key={index} divider>
                <ListItemText primary={email} />
                <ListItemSecondaryAction>
                  <IconButton onClick={() => handleEdit("email", index, email)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete("email", index)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Yetkili Kullanıcılar</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd("user")}>
              Kullanıcı Ekle
            </Button>
          </Box>
          <List>
            {users.map((user, index) => (
              <ListItem key={index} divider>
                <ListItemText primary={user} />
                <ListItemSecondaryAction>
                  <IconButton onClick={() => handleEdit("user", index, user)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete("user", index)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Özel Form Alanları</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd("field")}>
              Alan Ekle
            </Button>
          </Box>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
            {customFields.map((field, index) => (
              <Chip
                key={index}
                label={field}
                onDelete={() => handleDelete("field", index)}
                onClick={() => handleEdit("field", index, field)}
                sx={{ cursor: "pointer" }}
              />
            ))}
          </Box>
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="h6">Makine Tipleri</Typography>
            <Button variant="contained" startIcon={<Add />} onClick={() => handleAdd("machine")}>
              Makine Ekle
            </Button>
          </Box>
          <List>
            {machines.map((machine, index) => (
              <ListItem key={index} divider>
                <ListItemText primary={machine} />
                <ListItemSecondaryAction>
                  <IconButton onClick={() => handleEdit("machine", index, machine)}>
                    <Edit />
                  </IconButton>
                  <IconButton onClick={() => handleDelete("machine", index)}>
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        <TabPanel value={tabValue} index={4}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Proje Ayarları
            </Typography>
            <TextField
              fullWidth
              label="Toplam Kazık Sayısı"
              type="number"
              value={totalPiles}
              onChange={(e) => setTotalPiles(e.target.value)}
              helperText="Bu değer proje için sabit kalacak ve raporlarda kullanılacaktır"
              sx={{ mb: 2 }}
            />
          </Box>
        </TabPanel>

        <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
          <Button variant="contained" size="large" onClick={saveSettings} disabled={loading}>
            {loading ? "Kaydediliyor..." : "Ayarları Kaydet"}
          </Button>
        </Box>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              fullWidth
              variant="outlined"
              value={dialogValue}
              onChange={(e) => setDialogValue(e.target.value)}
              placeholder={getPlaceholder()}
              type={dialogType === "email" ? "email" : "text"}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={handleDialogSave} variant="contained">
              Kaydet
            </Button>
          </DialogActions>
        </Dialog>
      </Paper>
    </Container>
  )
}

export default function AdminBypassPage() {
  return <AdminPanelBypass />
} 