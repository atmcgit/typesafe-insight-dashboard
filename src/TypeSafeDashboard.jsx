import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { IconBolt, IconCheck, IconCode, IconInfoCircle, IconPlayerPlay, IconPlus, IconRefresh, IconSettings, IconSparkles } from '@tabler/icons-react';
import { buildTypesafeQuestions, evaluatePosts } from './typesafeClient';

const COLORS = { relevant: '#5fd97e', irrelevant: '#f16a63', uncertain: '#e8b34a' };
const LABELS = { relevant: 'Uygun', irrelevant: 'İlgisiz', uncertain: 'Belirsiz' };
const LIVE_DEBOUNCE_MS = 700;
const LIVE_MIN_CHARS = 3;

/** Boş tuval: canlıya alındığında araç herhangi bir keyword için sıfırdan başlar. */
const blankState = JSON.stringify({
  keyword: '',
  targetContext: { label: '', description: '', include: [], exclude: [] },
  posts: [],
}, null, 2);

/** Örnek: yalnızca ilk kez açanlara aracın nasıl çalıştığını göstermek için, "Örneği yükle" ile getirilir. */
const exampleState = JSON.stringify({
  keyword: 'Mavi',
  targetContext: {
    label: 'Mavi giyim markası',
    description: 'Mavi adlı giyim ve denim markası; markanın ürünleri, mağazaları, kampanyaları, reklamları ve şirket faaliyetleri.',
    include: ['Mavi mağazaları', 'Mavi ürünleri ve koleksiyonları', 'Mavi reklamları ve kampanyaları', 'Mavi şirket haberleri'],
    exclude: ['Mavi renk', 'Gökyüzü veya deniz', 'Bir eşyanın ya da kıyafetin rengi', 'Kişi adı veya kullanıcı adı'],
  },
  posts: [
    { postId: 'mavi-001', content: 'Mavi, yeni sezon denim koleksiyonunda sürdürülebilir kumaş kullanımını artırdı.', platform: 'X', username: 'modahaberleri' },
  ],
}, null, 2);

const FIELD_HINTS = {
  keyword: 'Postlarda aranacak kelime. Marka, ürün, kişi adı ya da çok anlamlı herhangi bir terim olabilir — "Nike", "Ada", "Elma" gibi.',
  label: 'Bu kelimeyi hangi anlamda aradığını kısaca adlandır. Örn. "Nike spor giyim markası" ya da "Ada adında bir kullanıcı".',
  description: 'JEV\'in ayırt etmesini istediğin tam tanım. Ne kadar net yazarsan sınıflandırma o kadar isabetli olur.',
  include: 'Hedef anlamı destekleyen somut sinyaller — mağaza adı, ürün kategorisi, kampanya adı gibi. Her satıra bir tane.',
  exclude: 'Aynı kelimenin karıştırılabileceği FARKLI anlamlar — bir renk, bir kişi adı, alakasız bir kullanım gibi.',
};

function FieldLabel({ text, hint }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" className="ts-field-label">
      <Typography component="span" className="ts-field-label-text">{text}</Typography>
      <Tooltip title={hint} arrow placement="top">
        <IconInfoCircle size={14} className="ts-field-hint-icon" />
      </Tooltip>
    </Stack>
  );
}

FieldLabel.propTypes = { text: PropTypes.string.isRequired, hint: PropTypes.string.isRequired };

const formatMs = (value) => `${Math.round(Number(value || 0)).toLocaleString('tr-TR')} ms`;

const parseState = (value) => {
  const parsed = JSON.parse(value);
  if (typeof parsed?.keyword !== 'string' || !Array.isArray(parsed.posts) || !parsed.targetContext || typeof parsed.targetContext !== 'object') {
    throw new Error('State; keyword, targetContext ve posts alanlarını içermeli.');
  }
  return parsed;
};

const validateState = (state) => {
  if (!state.keyword.trim()) throw new Error('Keyword alanı boş bırakılamaz.');
  if (!`${state.targetContext.label || ''}`.trim()) throw new Error('Hedef anlam alanı boş bırakılamaz.');
  if (!`${state.targetContext.description || ''}`.trim()) throw new Error('Hedef bağlam açıklaması boş bırakılamaz.');
  if (!state.posts.length) throw new Error('Değerlendirmek için en az bir post eklemelisin.');
  if (state.posts.some((post) => !post?.postId || !post?.content)) throw new Error('Her post, postId ve content alanlarını içermeli.');
  return state;
};

const linesToList = (value) => value.split('\n').map((item) => item.trim());
const listToLines = (value) => (Array.isArray(value) ? value.join('\n') : '');
const slugify = (value) => value.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'post';

/** Canlı ölçüm halkası: bekleme sırasında nabız gibi atar, sonuç gelince yay dolar. */
function LiveGauge({ status, choice, confidence, elapsedMs }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const pct = status === 'done' ? Math.max(0, Math.min(100, confidence)) : 0;
  const color = status === 'done' ? (COLORS[choice] || '#8a8a8f') : '#3a3a40';

  return (
    <div className={`ts-gauge${status === 'pending' ? ' is-pending' : ''}`}>
      <div className="ts-gauge-ring">
        {status === 'pending' && <span className="ts-gauge-pulse" />}
        <svg viewBox="0 0 128 128" width={148} height={148}>
          <circle cx="64" cy="64" r={radius} className="ts-gauge-track" />
          <motion.circle
            cx="64" cy="64" r={radius}
            className="ts-gauge-fill"
            stroke={color}
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: circumference - (pct / 100) * circumference }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>
        <div className="ts-gauge-center">
          {status === 'idle' && <span className="ts-gauge-idle">yaz…</span>}
          {status === 'pending' && <IconBolt className="ts-gauge-bolt" size={22} />}
          {status === 'done' && (
            <>
              <span className="ts-gauge-pct" style={{ color }}>{pct.toFixed(0)}%</span>
              <span className="ts-gauge-label">{LABELS[choice] || choice}</span>
            </>
          )}
          {status === 'error' && <span className="ts-gauge-idle">hata</span>}
        </div>
      </div>
      <div className="ts-gauge-speed">
        <span className="ts-gauge-speed-dot" style={{ opacity: status === 'pending' ? 1 : 0.35 }} />
        {formatMs(elapsedMs)}
      </div>
    </div>
  );
}

LiveGauge.propTypes = {
  status: PropTypes.oneOf(['idle', 'pending', 'done', 'error']).isRequired,
  choice: PropTypes.string,
  confidence: PropTypes.number,
  elapsedMs: PropTypes.number,
};

function MiniCard({ result, index }) {
  const choice = result.choice || 'uncertain';
  const color = COLORS[choice] || COLORS.uncertain;
  const confidence = Number(result.confidence || result.probabilities?.[choice] || 0);
  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.03, duration: 0.25 }}>
      <Paper className="ts-mini-card" elevation={0}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <span className="ts-status-dot" style={{ background: color }} />
          <Typography className="ts-mini-id">{result.post.postId}</Typography>
          <Typography className="ts-mini-pct" style={{ color }}>{confidence.toFixed(0)}%</Typography>
        </Stack>
        <Typography className="ts-mini-copy" title={result.post.content}>{result.post.content}</Typography>
      </Paper>
    </motion.div>
  );
}

MiniCard.propTypes = {
  result: PropTypes.shape({
    choice: PropTypes.string,
    confidence: PropTypes.number,
    probabilities: PropTypes.objectOf(PropTypes.number),
    post: PropTypes.shape({ postId: PropTypes.string, content: PropTypes.string }).isRequired,
  }).isRequired,
  index: PropTypes.number.isRequired,
};

function DistributionBar({ results }) {
  const total = results.length || 1;
  const counts = { relevant: 0, irrelevant: 0, uncertain: 0 };
  results.forEach((item) => { counts[item.choice || 'uncertain'] = (counts[item.choice || 'uncertain'] || 0) + 1; });
  return (
    <div className="ts-dist">
      <div className="ts-dist-track">
        {['relevant', 'irrelevant', 'uncertain'].map((key) => (
          counts[key] > 0 && (
            <motion.span
              key={key}
              className="ts-dist-seg"
              style={{ background: COLORS[key] }}
              initial={{ width: 0 }}
              animate={{ width: `${(counts[key] / total) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          )
        ))}
      </div>
      <Stack direction="row" spacing={2} className="ts-dist-legend">
        {['relevant', 'irrelevant', 'uncertain'].map((key) => (
          <Stack key={key} direction="row" spacing={0.5} alignItems="center">
            <span className="ts-legend-dot" style={{ background: COLORS[key] }} />
            <Typography className="ts-legend-text">{LABELS[key]} {counts[key]}</Typography>
          </Stack>
        ))}
      </Stack>
    </div>
  );
}

DistributionBar.propTypes = { results: PropTypes.array.isRequired };

export default function TypeSafeDashboard() {
  const [stateText, setStateText] = useState(exampleState);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const apiKey = 'proxy';
  const [results, setResults] = useState([]);
  const [runState, setRunState] = useState('idle');
  const [error, setError] = useState('');
  const [runStats, setRunStats] = useState({ totalMs: 0, averageMs: 0 });

  const [livePost, setLivePost] = useState('');
  const [liveStatus, setLiveStatus] = useState('idle');
  const [liveResult, setLiveResult] = useState(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  const parsedState = useMemo(() => {
    try { return parseState(stateText); } catch { return null; }
  }, [stateText]);

  const contextReady = Boolean(parsedState?.keyword?.trim() && parsedState?.targetContext?.label?.trim() && parsedState?.targetContext?.description?.trim());

  useEffect(() => {
    const text = livePost.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < LIVE_MIN_CHARS || !contextReady) {
      requestIdRef.current += 1;
      setLiveStatus('idle');
      setLiveResult(null);
      return undefined;
    }
    debounceRef.current = setTimeout(async () => {
      const myId = (requestIdRef.current += 1);
      setLiveStatus('pending');
      try {
        const summary = await evaluatePosts({
          posts: [{ postId: 'canli', content: text }],
          keyword: parsedState.keyword,
          targetContext: parsedState.targetContext,
          apiKey,
        });
        if (myId !== requestIdRef.current) return;
        setLiveResult(summary.results[0]);
        setLiveStatus('done');
      } catch (caughtError) {
        if (myId !== requestIdRef.current) return;
        setLiveStatus('error');
        setError(caughtError.message || 'Canlı değerlendirme başarısız.');
      }
    }, LIVE_DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [livePost, parsedState, contextReady, apiKey]);

  useEffect(() => {
    if (liveStatus !== 'pending') return undefined;
    const start = performance.now();
    setLiveElapsed(0);
    const id = setInterval(() => setLiveElapsed(performance.now() - start), 40);
    return () => clearInterval(id);
  }, [liveStatus]);

  const updateKeyword = (keyword) => {
    try {
      const state = parseState(stateText);
      setStateText(JSON.stringify({ ...state, keyword }, null, 2));
    } catch {
      setError('Önce State JSON formatını düzeltmelisin.');
    }
  };

  const updateTargetContext = (field, value) => {
    try {
      const state = parseState(stateText);
      setStateText(JSON.stringify({ ...state, targetContext: { ...state.targetContext, [field]: value } }, null, 2));
      setError('');
    } catch {
      setError('Bağlam alanlarını düzenlemek için önce State JSON formatını düzeltmelisin.');
    }
  };

  const addLiveToList = () => {
    const text = livePost.trim();
    if (!text) { setError('Listeye eklemek için önce bir post metni yaz.'); return; }
    try {
      const state = parseState(stateText);
      const post = { postId: `${slugify(state.keyword)}-${Date.now()}`, content: text };
      setStateText(JSON.stringify({ ...state, posts: [...state.posts, post] }, null, 2));
      setError('');
    } catch {
      setError('Listeye eklemek için State JSON formatını düzeltmelisin.');
    }
  };

  const runEvaluation = async () => {
    setError(''); setResults([]); setRunState('running');
    try {
      const state = validateState(parseState(stateText));
      const summary = await evaluatePosts({ posts: state.posts, keyword: state.keyword, targetContext: state.targetContext, apiKey, onResult: (result) => setResults((current) => [...current, result]) });
      setRunStats({ totalMs: summary.totalMs, averageMs: summary.averageMs });
      setRunState('complete');
    } catch (caughtError) {
      setError(caughtError.message || 'Değerlendirme başarısız.');
      setRunState('error');
    }
  };

  const clearRunOutput = () => {
    setResults([]); setError(''); setRunState('idle');
    setRunStats({ totalMs: 0, averageMs: 0 }); setLivePost(''); setLiveResult(null); setLiveStatus('idle');
  };

  const startNewAnalysis = () => {
    setStateText(blankState); clearRunOutput(); setSettingsOpen(true);
  };

  const loadExample = () => {
    setStateText(exampleState); clearRunOutput(); setSettingsOpen(false);
  };

  const questions = parsedState ? buildTypesafeQuestions(parsedState) : {};
  const postCount = parsedState?.posts?.length || 0;
  const heroKeyword = parsedState?.keyword?.trim();

  return (
    <Box className="ts-shell">
      <Box className="ts-topbar">
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box className="ts-logo"><IconBolt size={19} /></Box>
          <Box><Typography className="ts-brand">TypeSafe Insight</Typography><Typography className="ts-subbrand">Semantic evaluation console</Typography></Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={apiKey ? 'API bağlı' : 'Demo modu'} className={apiKey ? 'ts-live-chip' : 'ts-demo-chip'} icon={apiKey ? <IconCheck size={14} /> : <IconCode size={14} />} />
          <Button onClick={loadExample} variant="text" size="small" startIcon={<IconSparkles size={15} />} className="ts-example-button">Örneği yükle</Button>
          <Button onClick={startNewAnalysis} variant="outlined" size="small" startIcon={<IconRefresh size={15} />} className="ts-secondary-button">Yeni analiz</Button>
          <Tooltip title="Ayarlar aşağıda, 'Bağlam ayarları'nı aç"><IconButton aria-label="Ayarlar" className="ts-muted-button" onClick={() => setSettingsOpen((current) => !current)}><IconSettings size={19} /></IconButton></Tooltip>
        </Stack>
      </Box>

      <Box className="ts-content">
        {error && <Alert severity="error" onClose={() => setError('')} className="ts-alert">{error}</Alert>}

        <Box className="ts-hero">
          <Paper className="ts-hero-input" elevation={0}>
            <Typography className="ts-hero-kicker">{heroKeyword ? `${heroKeyword} · canlı değerlendirme` : 'Yeni değerlendirme'}</Typography>
            <Typography className="ts-hero-title">Bir gönderi yaz, JEV anlamını anında doğrulasın</Typography>
            {!contextReady && (
              <Typography className="ts-hero-setup-hint">
                Önce aşağıdaki <strong>Bağlam ayarları</strong>'ndan keyword ve hedef anlamı tanımla — herhangi bir marka, ürün ya da isim olabilir.
              </Typography>
            )}
            <TextField
              value={livePost}
              onChange={(event) => setLivePost(event.target.value)}
              placeholder={heroKeyword ? `Örn. "${heroKeyword}" geçen bir gönderi yaz…` : 'Önce bağlam ayarlarını doldur…'}
              disabled={!contextReady}
              multiline minRows={4} maxRows={8} fullWidth
              className="ts-hero-textarea"
            />
            <Stack direction="row" spacing={1.25} alignItems="center" className="ts-hero-actions">
              <Button onClick={addLiveToList} disabled={!contextReady} variant="outlined" startIcon={<IconPlus size={16} />} className="ts-add-post-button">Listeye ekle</Button>
              <Typography className="ts-hero-hint">{postCount} post listede</Typography>
            </Stack>
          </Paper>
          <Paper className="ts-hero-gauge-card" elevation={0}>
            <LiveGauge
              status={liveStatus}
              choice={liveResult?.choice}
              confidence={Number(liveResult?.confidence || liveResult?.probabilities?.[liveResult?.choice] || 0)}
              elapsedMs={liveStatus === 'pending' ? liveElapsed : liveResult?.elapsedMs}
            />
            <Typography className="ts-hero-gauge-caption">
              {liveStatus === 'idle' && `En az ${LIVE_MIN_CHARS} karakter yaz, ${LIVE_DEBOUNCE_MS} ms sonra otomatik ölçülür.`}
              {liveStatus === 'pending' && 'JEV değerlendiriyor…'}
              {liveStatus === 'done' && 'Yazmaya devam et, sonuç güncellenir.'}
              {liveStatus === 'error' && 'Ölçüm başarısız oldu, tekrar dene.'}
            </Typography>
          </Paper>
        </Box>

        <Box component="details" className="ts-settings" open={settingsOpen} onToggle={(event) => setSettingsOpen(event.target.open)}>
          <Box component="summary">Bağlam ayarları — keyword, hedef anlam, dahil/hariç tutulacaklar</Box>
          <Box className="ts-settings-body">
            <TextField label={<FieldLabel text="Keyword" hint={FIELD_HINTS.keyword} />} value={parsedState?.keyword || ''} onChange={(event) => updateKeyword(event.target.value)} size="small" fullWidth placeholder="Örn. Nike, Tesla, Ada…" />
            <TextField label={<FieldLabel text="Hedef anlam" hint={FIELD_HINTS.label} />} value={parsedState?.targetContext?.label || ''} onChange={(event) => updateTargetContext('label', event.target.value)} size="small" fullWidth placeholder="Örn. Nike spor giyim markası" />
            <TextField label={<FieldLabel text="Hedef bağlam açıklaması" hint={FIELD_HINTS.description} />} value={parsedState?.targetContext?.description || ''} onChange={(event) => updateTargetContext('description', event.target.value)} multiline minRows={2} maxRows={5} fullWidth size="small" placeholder="JEV'in ayırt etmesini istediğin anlamı bir iki cümleyle tarif et." />
            <Box className="ts-context-lists">
              <TextField label={<FieldLabel text="Dahil edilecek bağlamlar" hint={FIELD_HINTS.include} />} value={listToLines(parsedState?.targetContext?.include)} onChange={(event) => updateTargetContext('include', linesToList(event.target.value))} multiline minRows={3} maxRows={6} fullWidth size="small" helperText="Her satıra bir örnek veya sinyal" />
              <TextField label={<FieldLabel text="Hariç tutulacak bağlamlar" hint={FIELD_HINTS.exclude} />} value={listToLines(parsedState?.targetContext?.exclude)} onChange={(event) => updateTargetContext('exclude', linesToList(event.target.value))} multiline minRows={3} maxRows={6} fullWidth size="small" helperText="Her satıra farklı veya istenmeyen bir anlam" />
            </Box>
            <Box component="details" className="ts-settings-nested">
              <Box component="summary">JEV sorgu şablonu ve ham state ({Object.keys(questions).length} soru)</Box>
              <Box component="pre" className="ts-question-code">{JSON.stringify(questions, null, 2)}</Box>
              <TextField label="State JSON" multiline minRows={6} maxRows={14} fullWidth value={stateText} onChange={(event) => setStateText(event.target.value)} className="ts-editor" helperText="Form alanları ve post listesini tek bir JSON üzerinden düzenleyebilirsin." />
              <Typography className="ts-proxy-note">API anahtarı yerel proxy üzerinden güvenli şekilde kullanılıyor.</Typography>
            </Box>
          </Box>
        </Box>

        <Box className="ts-list-section">
          <Stack direction="row" justifyContent="space-between" alignItems="center" className="ts-list-header">
            <Typography className="ts-list-title">Liste <span>{postCount}</span></Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={runEvaluation} disabled={runState === 'running' || !parsedState || postCount === 0} variant="contained" startIcon={<IconPlayerPlay size={16} />} className="ts-run-button">{runState === 'running' ? 'Çalışıyor…' : 'Tümünü çalıştır'}</Button>
            </Stack>
          </Stack>

          {results.length > 0 && (
            <Stack direction="row" spacing={3} alignItems="center" className="ts-run-summary">
              <DistributionBar results={results} />
              <Typography className="ts-run-summary-text">{formatMs(runStats.averageMs)} · post başına ortalama</Typography>
            </Stack>
          )}

          <Box className="ts-mini-grid">
            {postCount === 0 && (
              <Box className="ts-list-empty">
                <IconPlus size={20} />
                <Typography>Yukarıdaki kutuya bir gönderi yaz ve "Listeye ekle"ye bas — burada birikir, sonra hepsini birden çalıştırabilirsin.</Typography>
              </Box>
            )}
            <AnimatePresence>
              {results.length > 0
                ? results.map((result, index) => <MiniCard key={result.post.postId} result={result} index={index} />)
                : (parsedState?.posts || []).map((post) => (
                  <Paper key={post.postId} className="ts-mini-card is-pending-card" elevation={0}>
                    <Typography className="ts-mini-id">{post.postId}</Typography>
                    <Typography className="ts-mini-copy">{post.content}</Typography>
                  </Paper>
                ))}
            </AnimatePresence>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
