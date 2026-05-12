# Control Financiero Pro — PRD

## Overview
Mobile-first personal finance app (Expo React Native + FastAPI + MongoDB) reproducing the features of the original "Control Financiero Pro" HTML/Kotlin reference files in Spanish.

## Features
- **Auth**: Email/password (JWT) + Emergent-managed Google OAuth.
- **Dashboard**: Monthly net balance hero card, income/expense stats, 6-month bar chart (income vs expense), expense-by-category donut, recent transactions, refresh, logout.
- **Movimientos**: Search, type filter (Todos/Ingresos/Gastos), month chips, list, long-press to delete, FAB to add.
- **Presupuestos**: Per-category monthly budgets with progress bar (green/yellow/red), month switcher, long-press to delete.
- **Metas**: Savings goals with progress bar, in-card contribute input + button, color tag, delete.
- **Add Transaction sheet**: type toggle (Gasto/Ingreso), title, amount, category chips, account chips, month, note. Includes "Escanear recibo con IA" button → opens gallery → backend GPT-4o vision call auto-fills form.

## Tech
- Frontend: Expo 54, expo-router file routing, react-native-gifted-charts (with expo-linear-gradient), @expo/vector-icons, @gorhom/bottom-sheet, expo-image-picker, expo-secure-store, axios, @expo-google-fonts/manrope + outfit.
- Backend: FastAPI, motor (Mongo), httpx, PyJWT, bcrypt, emergentintegrations (GPT-4o vision via Emergent LLM key).
- Design tokens loaded from `/app/design_guidelines.json` (Organic & Earthy palette: Forest Green `#386641` brand, Off-white `#F4F1EB` bg, Terracotta `#BC4749` expense).

## Categories
`Alimentación, Transporte, Vivienda, Servicios, Salud, Entretenimiento, Ropa, Educación, Otros` — each with unique icon + color in `src/categories.ts`.

## API (all under `/api`)
- `POST /auth/register`, `POST /auth/login`, `POST /auth/google/session`, `GET /auth/me`, `POST /auth/logout`
- `GET/POST/PUT/DELETE /transactions`, `GET /summary`
- `GET/POST/DELETE /budgets`
- `GET/POST/DELETE /goals`, `POST /goals/{id}/contribute`
- `POST /analyze-receipt` (image_base64 → {title, amount, category, type, month})
- `GET /categories`

## Smart business enhancement
The AI receipt scanner is the differentiator: users can capture a receipt photo and let GPT-4o vision auto-extract title, amount, category, and date in one tap, removing the friction that kills 90% of finance-tracking apps.
