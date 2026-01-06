# 🚗 FuelFlow

Sistema per la gestione e tracciamento dei rifornimenti carburante con OCR automatico delle ricevute.

## ✅ Setup Completato

- **Database**: Supabase (`xxwuhrmqtaclippvxaal`)
- **OCR**: Google Gemini 2.5 Flash API
- **Auth**: Email/Password (Supabase Auth)
- **Storage**: Bucket privato per ricevute

## 🚀 Quick Start

```bash
# Installazione dipendenze
npm install

# Avvio sviluppo
npm run dev
# Apri http://localhost:8080

# Build produzione
npm run build
```

## 📋 Funzionalità

- ✅ **Autenticazione utenti** (registrazione/login)
- ✅ **Gestione cantieri** personalizzati
- ✅ **Inserimento rifornimenti** manuale o via OCR
- ✅ **OCR automatico** ricevute carburante (Google Gemini)
- ✅ **Storage sicuro** immagini ricevute
- ✅ **Esportazione dati** in Excel
- ✅ **Statistiche** consumi e costi
- ✅ **Multi-utente** con isolamento dati (RLS)

## 🔧 Configurazione

Vedi [SETUP_COMPLETO.md](./SETUP_COMPLETO.md) per:
- Credenziali Supabase
- Configurazione OCR
- Comandi deployment

## 📸 Consigli per OCR Ottimale

Per migliori risultati nell'estrazione automatica:
- Foto ben illuminata e nitida
- Ricevuta piatta (senza pieghe)
- Testo chiaramente leggibile
- Inquadratura completa

## 📚 Tecnologie

- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **OCR**: Google Gemini 2.5 Flash
- **Edge Functions**: Deno runtime

## 📄 Licenza

Progetto privato
