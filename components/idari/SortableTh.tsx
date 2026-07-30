"use client"

import { Box, IconButton, TableCell, Tooltip, Typography } from "@mui/material"
import type { SxProps, Theme } from "@mui/material/styles"

export type SortDir = "asc" | "desc"

export function SortableTh({
  label,
  sortKey,
  sortBy,
  sortDir,
  onSort,
  align,
  sx,
}: {
  label: string
  sortKey: string
  sortBy: string
  sortDir: SortDir
  onSort: (key: string, dir: SortDir) => void
  align?: "left" | "center" | "right"
  sx?: SxProps<Theme>
}) {
  const active = sortBy === sortKey
  const justify =
    align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start"
  return (
    <TableCell align={align} sx={sx}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: justify,
          gap: 0.5,
          flexWrap: "wrap",
        }}
      >
        <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Tooltip title="A → Z">
            <IconButton
              size="small"
              aria-label={`${label} A-Z sırala`}
              onClick={() => onSort(sortKey, "asc")}
              sx={{
                p: 0.35,
                minWidth: 28,
                color: active && sortDir === "asc" ? "primary.main" : "action.disabled",
              }}
            >
              <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 800, lineHeight: 1 }}>
                A→Z
              </Typography>
            </IconButton>
          </Tooltip>
          <Tooltip title="Z → A">
            <IconButton
              size="small"
              aria-label={`${label} Z-A sırala`}
              onClick={() => onSort(sortKey, "desc")}
              sx={{
                p: 0.35,
                minWidth: 28,
                color: active && sortDir === "desc" ? "primary.main" : "action.disabled",
              }}
            >
              <Typography variant="caption" sx={{ fontSize: "0.65rem", fontWeight: 800, lineHeight: 1 }}>
                Z→A
              </Typography>
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </TableCell>
  )
}
