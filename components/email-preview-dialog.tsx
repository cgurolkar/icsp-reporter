"use client"

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, Chip } from "@mui/material"
import { useLanguage } from "@/contexts/language-context"

interface EmailPreviewDialogProps {
  open: boolean
  onClose: () => void
  emailContent: string
  recipients: string[]
}

export default function EmailPreviewDialog({ open, onClose, emailContent, recipients }: EmailPreviewDialogProps) {
  const { t } = useLanguage()

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          maxHeight: "90vh",
        },
      }}
    >
      <DialogTitle
        component="div" // <- render <div>, not <h2>
        sx={{
          background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
          color: "white",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <Typography
          variant="h6"
          component="span" // <- render <span>, keep h6 styles
          sx={{ fontWeight: 600 }}
        >
          {t("email_preview")}
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" component="span" sx={{ opacity: 0.9 }}>
            {t("recipients")}:
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
            {recipients.map((email, index) => (
              <Chip
                key={index}
                label={email}
                size="small"
                sx={{
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  color: "white",
                  "& .MuiChip-deleteIcon": { color: "white" },
                }}
              />
            ))}
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Box
          sx={{
            border: "none",
            p: 3,
            backgroundColor: "#f9f9f9",
            maxHeight: "60vh",
            overflow: "auto",
          }}
        >
          <div dangerouslySetInnerHTML={{ __html: emailContent }} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 3, backgroundColor: "#f5f5f5" }}>
        <Button
          onClick={onClose}
          variant="contained"
          size="large"
          sx={{
            borderRadius: 2,
            px: 4,
            background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
          }}
        >
          {t("close")}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
