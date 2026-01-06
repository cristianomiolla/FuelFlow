# ✅ Fuel Flow - Migrazione Completata

## 🎉 Configurazione Supabase

- **Project ID**: `xxwuhrmqtaclippvxaal`
- **URL**: https://xxwuhrmqtaclippvxaal.supabase.co
- **Dashboard**: https://supabase.com/dashboard/project/xxwuhrmqtaclippvxaal

## 🔧 Configurazione OCR

- **Provider**: Google Gemini 2.5 Flash
- **API Key**: Configurata come secret `GOOGLE_AI_API_KEY`
- **Edge Function**: `ocr-receipt` (deployata)

## 📊 Database

### Tabelle Create
- ✅ `cantieri` - Cantieri/Siti (user-scoped)
- ✅ `rifornimenti` - Dati rifornimenti (user-scoped)
- ✅ `tipi_carburante` - Tipi carburante (shared, 8 tipi precaricati)

### Storage
- ✅ Bucket `receipts` (privato, user-scoped)

## 🚀 Comandi Utili

```bash
# Sviluppo
npm run dev

# Build
npm run build

# Deploy edge function (se modificata)
npx supabase functions deploy ocr-receipt

# Gestione secrets
npx supabase secrets list
npx supabase secrets set NOME_SECRET=valore

# Logs edge function
npx supabase functions logs ocr-receipt
```

## 🔍 Troubleshooting OCR

Se l'OCR non estrae i dati correttamente:

1. **Verifica logs Edge Function**:
   ```bash
   npx supabase functions logs ocr-receipt --follow
   ```

2. **Controlla Secret**:
   ```bash
   npx supabase secrets list
   ```
   Deve essere presente `GOOGLE_AI_API_KEY`

3. **Testa manualmente la funzione** dal Dashboard:
   - Vai su Edge Functions → ocr-receipt → Invoke
   - Payload di test:
   ```json
   {
     "image_base64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
   }
   ```

4. **Verifica limiti Google AI**:
   - Free tier: 60 richieste/minuto
   - Se superi il limite, attendi 1 minuto

## 📝 Note Importanti

- **Autenticazione richiesta**: Tutte le operazioni richiedono login
- **User Isolation**: Ogni utente vede solo i propri dati (RLS)
- **Storage privato**: Immagini ricevute accessibili solo dal proprietario
- **Formato immagini OCR**: JPEG/PNG, max 10MB

## 🔗 Links Utili

- [Supabase Docs](https://supabase.com/docs)
- [Google AI Studio](https://aistudio.google.com)
- [Gemini API Docs](https://ai.google.dev/gemini-api/docs)
