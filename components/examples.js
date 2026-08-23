/* One example per reference component, as generative-UI specification nodes.
 *
 * Not HTML. Writing the examples as markup would put component names in a third
 * place — after the stylesheet and the manifest — and the three would drift.
 * As specs they are validated by genai/validate.js and rendered by the same
 * renderer the MCP server uses, so an example naming a component that is not in
 * the manifest fails when the page is generated rather than rendering wrongly.
 *
 * That makes the components page a test of the manifest as well as a catalogue:
 * a component whose `element` is wrong here shows up wrong on the page, in
 * public, where it would otherwise only be wrong over MCP.
 */

const t = (component, text, rest = {}) => ({ component, text, ...rest })

export const EXAMPLES = {
  /* Feedback */
  alert: t('alert', 'Your export finished.', { tone: 'success' }),
  badge: t('badge', 'beta', { tone: 'info', variant: 'soft' }),
  dot: { component: 'dot', tone: 'success' },
  spinner: { component: 'spinner' },
  skeleton: { component: 'skeleton' },

  /* Surfaces */
  card: {
    component: 'card',
    children: [t('stat-label', 'Storage used'), t('stat-value', '48.6 GB')],
  },
  panel: { component: 'panel', children: [t('badge', 'panel content')] },
  divider: t('divider', 'or'),

  /* Data */
  stat: {
    component: 'stat',
    children: [t('stat-label', 'Requests today'), t('stat-value', '18,204')],
  },
  'stat-label': t('stat-label', 'Requests today'),
  'stat-value': t('stat-value', '18,204'),

  /* Navigation */
  menu: { component: 'menu' },
  crumbs: { component: 'crumbs' },
  steps: { component: 'steps' },

  /* Conversation */
  bubble: t('bubble', 'Is the deploy finished?'),
  avatar: t('avatar', 'VR'),

  /* Overlay */
  tip: t('tip', 'hover me'),

  /* Text */
  prose: t('prose', 'Long-form text, with its own vertical rhythm.'),

  /* Forms */
  field: {
    component: 'field',
    children: [
      t('field-label', 'Workspace name'),
      t('field-hint', 'Lowercase letters and hyphens.'),
    ],
  },
  'field-label': t('field-label', 'Workspace name'),
  'field-hint': t('field-hint', 'Lowercase letters and hyphens.'),
  'field-error': t('field-error', 'That name is already taken.'),

  /* Containers */
  'table-wrap': { component: 'table-wrap', children: [t('badge', 'a wide table goes here')] },
  toolbar: {
    component: 'toolbar',
    children: [
      t('badge', 'All', { tone: 'primary', variant: 'soft' }),
      t('badge', 'Open'),
      t('badge', 'Closed'),
    ],
  },

  /* Empty state */
  empty: {
    component: 'empty',
    children: [
      t('empty-title', 'No deployments yet'),
      t('empty-note', 'When you ship something, it will show up here.'),
    ],
  },
  'empty-title': t('empty-title', 'No deployments yet'),
  'empty-note': t('empty-note', 'When you ship something, it will show up here.'),

  /* Layout utilities */
  stack: {
    component: 'stack',
    children: [t('badge', 'first'), t('badge', 'second'), t('badge', 'third')],
  },
  row: { component: 'row', children: [t('badge', 'left'), t('badge', 'right')] },
  cluster: {
    component: 'cluster',
    children: [t('badge', 'css'), t('badge', 'design'), t('badge', 'largen')],
  },
  grid: {
    component: 'grid',
    children: [t('panel', 'one'), t('panel', 'two'), t('panel', 'three')],
  },
  center: { component: 'center', children: [t('badge', 'centred, at a measure')] },
}

/* Some components only make sense inside a parent — a stat-label alone is a
   fragment, not a demonstration. Naming them here keeps the page honest about
   which examples stand alone rather than quietly showing something misleading. */
export const FRAGMENTS = new Set([
  'stat-label', 'stat-value', 'field-label', 'field-hint', 'field-error',
  'empty-title', 'empty-note',
])

export default EXAMPLES
