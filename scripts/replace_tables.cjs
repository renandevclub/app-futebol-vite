const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

const replacements = [
  { from: /'fm_activity_logs'/g, to: "'_DELETED_fm_activity_logs_'" }, // Marcar para verificação
  { from: /'fm_profiles'/g, to: "'fm_perfis'" },
  { from: /"fm_profiles"/g, to: '"fm_perfis"' },
  { from: /'fm_matches'/g, to: "'fm_partidas'" },
  { from: /"fm_matches"/g, to: '"fm_partidas"' },
  { from: /'fm_player_stats'/g, to: "'fm_estatisticas_jogadores'" },
  { from: /"fm_player_stats"/g, to: '"fm_estatisticas_jogadores"' },
  { from: /'fm_player_draws'/g, to: "'fm_sorteios_jogadores'" },
  { from: /"fm_player_draws"/g, to: '"fm_sorteios_jogadores"' },
  { from: /'fm_match_votes'/g, to: "'fm_votos_partidas'" },
  { from: /"fm_match_votes"/g, to: '"fm_votos_partidas"' },
  { from: /'fm_standings'/g, to: "'fm_classificacao'" },
  { from: /"fm_standings"/g, to: '"fm_classificacao"' },
  { from: /'fm_notifications'/g, to: "'fm_notificacoes'" },
  { from: /"fm_notifications"/g, to: '"fm_notificacoes"' },
  { from: /'fm_notification_prefs'/g, to: "'fm_preferencias_notificacoes'" },
  { from: /"fm_notification_prefs"/g, to: '"fm_preferencias_notificacoes"' },
  { from: /'fm_draw_audit_logs'/g, to: "'fm_auditoria_sorteios'" },
  { from: /"fm_draw_audit_logs"/g, to: '"fm_auditoria_sorteios"' },
  // Configuracoes
  { from: /'fm_app_config'/g, to: "'configuracoes'" },
  { from: /"fm_app_config"/g, to: '"configuracoes"' },
  { from: /'settings'/g, to: "'configuracoes'" },
  { from: /"settings"/g, to: '"configuracoes"' }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.html')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      // Aplicar regexes
      for (const r of replacements) {
        if (r.from.test(content)) {
          content = content.replace(r.from, r.to);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(srcDir);
console.log('Done!');
