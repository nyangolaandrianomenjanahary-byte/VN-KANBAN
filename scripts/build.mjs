#!/usr/bin/env node
/**
 * Script de build — VN Gestion de tâches (Vercel + Supabase)
 * Assemble src/template.html + src/vendor/supabase.js + src/vn-cloud.js
 * vers index.html et public/index.html.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://unqfifaiywxuoqqtunya.supabase.co';

const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucWZpZmFpeXd4dW9xcXR1bnlhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMTQ1NzcsImV4cCI6MjEwNDY5MDU3N30.HqjKqQm0VQk_ECVeL4NFyaWUXOpXamlBtOvE_CVIuIg';

const templatePath = path.join(rootDir, 'src', 'template.html');
const supabaseUmdPath = path.join(rootDir, 'src', 'vendor', 'supabase.js');
const vnCloudPath = path.join(rootDir, 'src', 'vn-cloud.js');

const templateHtml = fs.readFileSync(templatePath, 'utf8');
const supabaseUmd = fs.readFileSync(supabaseUmdPath, 'utf8');
const vnCloudJs = fs.readFileSync(vnCloudPath, 'utf8');

const cloudBlock = `
    <!-- ================= VN CLOUD (generated) ================= -->
    <script>
        window.VN_CONFIG = {
            supabaseUrl: ${JSON.stringify(supabaseUrl)},
            supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)}
        };
    </script>
    <script>${supabaseUmd.trimEnd()}</script>
    <script>${vnCloudJs.trimEnd()}
</script>
    <!-- ================= /VN CLOUD ================= -->`;

const builtHtml = templateHtml.replace('    <!-- __VN_CLOUD_INJECT__ -->', cloudBlock);

fs.mkdirSync(path.join(rootDir, 'public'), { recursive: true });
fs.writeFileSync(path.join(rootDir, 'index.html'), builtHtml, 'utf8');
fs.writeFileSync(path.join(rootDir, 'public', 'index.html'), builtHtml, 'utf8');

const bytes = Buffer.byteLength(builtHtml, 'utf8');
const md5 = crypto.createHash('md5').update(builtHtml, 'utf8').digest('hex');
console.log(`[build] index.html & public/index.html générés (${bytes} octets, md5=${md5})`);
