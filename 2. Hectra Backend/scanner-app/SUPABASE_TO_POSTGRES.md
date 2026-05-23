# Supabase to PostgreSQL Query Conversion Guide

This document shows how to convert Supabase queries to PostgreSQL using our `database.js` helper.

## Common Patterns

### 1. SELECT with WHERE

**Supabase:**
```javascript
const { data, error } = await supabase
    .from('hewan')
    .select('*')
    .eq('id', uid);
```

**PostgreSQL:**
```javascript
const { data, error } = await db.select('hewan', '*', { id: uid });
```

### 2. SELECT with ILIKE (case-insensitive search)

**Supabase:**
```javascript
const { data, error } = await supabase
    .from('hewan')
    .select('*')
    .ilike('nama', query);
```

**PostgreSQL:**
```javascript
const { data, error } = await db.select('hewan', '*', { nama: { like: `%${query}%` } });
```

### 3. SELECT with ORDER BY and LIMIT

**Supabase:**
```javascript
const { data, error } = await supabase
    .from('reproduksi_ternak')
    .select('*')
    .eq('rfid', hewanId)
    .order('tanggal_ib', { ascending: false })
    .limit(1);
```

**PostgreSQL:**
```javascript
const { data, error } = await db.select(
    'reproduksi_ternak', 
    '*', 
    { rfid: hewanId },
    { orderBy: { column: 'tanggal_ib', ascending: false }, limit: 1 }
);
```

### 4. INSERT

**Supabase:**
```javascript
const { error } = await supabase
    .from('hewan')
    .insert([{
        id: uid,
        nama: nama,
        jenis: jenis
    }]);
```

**PostgreSQL:**
```javascript
const { data, error } = await db.insert('hewan', {
    id: uid,
    nama: nama,
    jenis: jenis
});
```

### 5. UPDATE

**Supabase:**
```javascript
const { error } = await supabase
    .from('reproduksi_ternak')
    .update({
        tanggal_ib: data.tanggal_ib,
        pemberi_ib: data.pemberi_ib
    })
    .eq('rfid', hewanId);
```

**PostgreSQL:**
```javascript
const { data, error } = await db.update(
    'reproduksi_ternak',
    {
        tanggal_ib: data.tanggal_ib,
        pemberi_ib: data.pemberi_ib
    },
    { rfid: hewanId }
);
```

### 6. DELETE

**Supabase:**
```javascript
const { error } = await supabase
    .from('reproduksi_ternak')
    .delete()
    .eq('rfid', rfid);
```

**PostgreSQL:**
```javascript
const { data, error} = await db.delete('reproduksi_ternak', { rfid: rfid });
```

### 7. UPSERT (INSERT with conflict handling)

**PostgreSQL (new feature):**
```javascript
const { data, error } = await db.upsert(
    'reproduksi_ternak',
    {
        rfid: hewanId,
        tanggal_ib: data.tanggal_ib,
        // ... other fields
    },
    'rfid'  // conflict column
);
```

## Response Format Differences

**Supabase:**
- Returns: `{ data, error }`
- `data` is the result array/object
- `error` is null on success

**PostgreSQL (our helper):**
- Returns: `{ data, error }` (same!)
- `data` is the result array (`.rows` internally)
- `error` is null on success

## Important Notes

1. **maybeSingle()**: In Supabase, `maybeSingle()` returns a single object or null.
   - Our helper returns an array, so use `data[0]` or `data && data.length > 0 ? data[0] : null`

2. **Error handling**: Same pattern works:
   ```javascript
   if (error) {
       console.error(error.message);
       return;
   }
   ```

3. **Empty results**: Check `data.length === 0` instead of `!data`

## Files to Update

Total ~50+ Supabase queries in app.js at these approximate lines:
- Lines 500-580: `/rh` command (remove history)
- Lines 740-800: Delete data flow
- Lines 850-950: Search data flow  
- Lines 1050-1150: Edit data flow
- Lines 1350-1450: Register hewan flow
- Lines 1650-1750: Tambah reproduksi flow
- Lines 2100-2300: Callback query handlers
- Lines 2500-2600: API endpoint `/api/scan-rfid`

## Testing Checklist

After conversion, test:
- [ ] RFID scan (read hewan data)
- [ ] Register new hewan
- [ ] Update hewan data
- [ ] Delete hewan data
- [ ] Add reproduksi data
- [ ] View riwayat reproduksi
- [ ] Search by name/RFID
- [ ] All Telegram bot commands work
