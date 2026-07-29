/**
 * Material Catalog — Luban 物料目录。
 *
 * Resources:
 *   luban://materials/catalog     (static — full catalog listing)
 *   luban://materials/{name}      (template — individual material detail)
 *
 * MIME: application/json
 *
 * 物料定义映射自 packages/ui/packages/luban-low-code/src/materials/
 * 实际物料注册，包含完整 propsSchema。
 *
 * @since 0.1.0
 */

import type {
  ResourceDef,
  ResourceTemplateDef,
} from './lib/resource-registry.js';

// ── Material catalog data ────────────────────────────────────────────

interface MaterialEntry {
  name: string;
  category: string;
  title: string;
  description: string;
  props: Record<string, unknown>;
}

type MaterialCatalog = Record<string, MaterialEntry>;

const CATEGORY_LABELS: Record<string, string> = {
  layout: '布局',
  general: '通用',
  content: '内容',
  form: '表单',
  'data-display': '数据展示',
  navigation: '导航',
  feedback: '反馈',
  marketing: '营销',
};

const MATERIALS: MaterialEntry[] = [
  // ── layout ────────────────────────────────────────────────────
  {
    name: 'LubanContainer',
    category: 'layout',
    title: '容器',
    description: '通用容器：限定最大宽度档位并提供内边距开关，用于页面根级布局。',
    props: {
      type: 'object',
      properties: {
        maxWidth: {
          type: 'string',
          enum: ['sm', 'md', 'lg', 'full'],
          default: 'full',
          description: '最大宽度档位，full 表示撑满父级。',
        },
        padded: {
          type: 'boolean',
          default: false,
          description: '是否启用内边距。',
        },
      },
    },
  },
  {
    name: 'LubanRow',
    category: 'layout',
    title: '行容器',
    description: 'flex 行/列容器：按方向排列子节点，提供对齐、间距与换行控制。',
    props: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['row', 'column'],
          default: 'row',
          description: '主轴方向。',
        },
        align: {
          type: 'string',
          enum: ['start', 'center', 'end'],
          default: 'start',
          description: '交叉轴对齐方式。',
        },
        justify: {
          type: 'string',
          enum: ['start', 'center', 'end', 'between'],
          default: 'start',
          description: '主轴对齐方式。',
        },
        gap: { type: 'number', default: 0, description: '子节点间距（px）。' },
        wrap: {
          type: 'boolean',
          default: true,
          description: '是否允许子节点换行。',
        },
      },
    },
  },
  {
    name: 'LubanCol',
    category: 'layout',
    title: '列',
    description: '栅格列：在 LubanRow 内部定宽/自适应排列。',
    props: {
      type: 'object',
      properties: {
        span: {
          type: 'number',
          default: 24,
          description: '栅格占位列数（共 24 列）。',
        },
        offset: {
          type: 'number',
          default: 0,
          description: '左侧偏移列数。',
        },
      },
    },
  },
  {
    name: 'LubanSidePanel',
    category: 'layout',
    title: '侧边面板',
    description: '侧边面板容器，用于侧边栏布局。',
    props: {
      type: 'object',
      properties: {
        position: {
          type: 'string',
          enum: ['left', 'right'],
          default: 'left',
          description: '面板位置。',
        },
        width: {
          type: 'string',
          default: '300px',
          description: '面板宽度。',
        },
        collapsible: {
          type: 'boolean',
          default: false,
          description: '是否可折叠。',
        },
      },
    },
  },
  // ── general ──────────────────────────────────────────────────
  {
    name: 'LubanButton',
    category: 'general',
    title: '按钮',
    description: '按钮，支持多种风格和尺寸。',
    props: {
      type: 'object',
      properties: {
        text: { type: 'string', default: '按钮', description: '按钮文字。' },
        variant: {
          type: 'string',
          enum: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
          default: 'primary',
          description: '按钮样式变体。',
        },
        size: {
          type: 'string',
          enum: ['small', 'medium', 'large'],
          default: 'medium',
          description: '按钮尺寸。',
        },
        disabled: {
          type: 'boolean',
          default: false,
          description: '是否禁用。',
        },
        loading: {
          type: 'boolean',
          default: false,
          description: '是否加载中。',
        },
        fullWidth: {
          type: 'boolean',
          default: false,
          description: '是否撑满父容器宽度。',
        },
        url: { type: 'string', default: '', description: '链接 URL（渲染为 <a>）。' },
      },
    },
  },
  {
    name: 'LubanText',
    category: 'general',
    title: '文本',
    description: '通用文本，支持语义化标签、排版变体与次色样式。',
    props: {
      type: 'object',
      properties: {
        content: { type: 'string', default: '', description: '文本内容。' },
        tag: {
          type: 'string',
          enum: ['p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
          default: 'p',
          description: '语义化 HTML 标签。',
        },
        variant: {
          type: 'string',
          enum: ['body1', 'body2', 'caption', 'h1', 'h2', 'h3'],
          default: 'body1',
          description: '排版变体。',
        },
        secondary: {
          type: 'boolean',
          default: false,
          description: '是否使用次色文本。',
        },
      },
    },
  },
  // ── content ──────────────────────────────────────────────────
  {
    name: 'LubanBanner',
    category: 'content',
    title: '横幅',
    description: '横幅展示区块，带背景图和叠加文字。',
    props: {
      type: 'object',
      properties: {
        image: { type: 'string', default: '', description: '背景图片 URL。' },
        title: { type: 'string', default: '', description: '横幅标题。' },
        subtitle: { type: 'string', default: '', description: '横幅副标题。' },
        height: {
          type: 'string',
          default: '300px',
          description: '横幅高度。',
        },
      },
    },
  },
  {
    name: 'LubanContentList',
    category: 'content',
    title: '内容列表',
    description: '可配置的内容列表，支持标题、描述、图标和链接。',
    props: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '列表项数组。',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              icon: { type: 'string' },
              link: { type: 'string' },
            },
          },
        },
        columns: {
          type: 'number',
          default: 1,
          description: '列数。',
        },
      },
    },
  },
  {
    name: 'LubanMarkdown',
    category: 'content',
    title: 'Markdown',
    description: 'Markdown 内容渲染组件，支持 GFM 语法。',
    props: {
      type: 'object',
      properties: {
        source: { type: 'string', default: '', description: 'Markdown 源码。' },
      },
    },
  },
  {
    name: 'LubanSteps',
    category: 'content',
    title: '步骤条',
    description: '分步指引组件。',
    props: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          description: '步骤数组。',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
        current: {
          type: 'number',
          default: 0,
          description: '当前步骤索引。',
        },
        direction: {
          type: 'string',
          enum: ['horizontal', 'vertical'],
          default: 'horizontal',
          description: '步骤条方向。',
        },
      },
    },
  },
  // ── form ─────────────────────────────────────────────────────
  {
    name: 'LubanForm',
    category: 'form',
    title: '表单',
    description: '表单容器，内嵌表单控件，支持 submit 事件。',
    props: {
      type: 'object',
      properties: {
        size: {
          type: 'string',
          enum: ['small', 'medium', 'large'],
          default: 'medium',
          description: '表单最大宽度档位。',
        },
      },
    },
  },
  {
    name: 'LubanInput',
    category: 'form',
    title: '输入框',
    description: '单行文本输入框。',
    props: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '', description: '字段标签。' },
        placeholder: {
          type: 'string',
          default: '',
          description: '占位提示文字。',
        },
        defaultValue: {
          type: 'string',
          default: '',
          description: '默认值。',
        },
        required: {
          type: 'boolean',
          default: false,
          description: '是否必填。',
        },
        disabled: {
          type: 'boolean',
          default: false,
          description: '是否禁用。',
        },
        type: {
          type: 'string',
          enum: ['text', 'email', 'tel', 'number', 'password', 'url'],
          default: 'text',
          description: '输入类型。',
        },
        maxLength: {
          type: 'number',
          description: '最大输入长度。',
        },
      },
    },
  },
  {
    name: 'LubanTextArea',
    category: 'form',
    title: '多行文本',
    description: '多行文本输入框。',
    props: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '', description: '字段标签。' },
        placeholder: {
          type: 'string',
          default: '',
          description: '占位提示文字。',
        },
        defaultValue: { type: 'string', default: '', description: '默认值。' },
        required: {
          type: 'boolean',
          default: false,
          description: '是否必填。',
        },
        rows: { type: 'number', default: 4, description: '行数。' },
        maxLength: { type: 'number', description: '最大输入长度。' },
      },
    },
  },
  {
    name: 'LubanSelect',
    category: 'form',
    title: '下拉选择',
    description: '下拉选择器。',
    props: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '', description: '字段标签。' },
        placeholder: {
          type: 'string',
          default: '请选择',
          description: '占位提示。',
        },
        options: {
          type: 'array',
          description: '选项数组。',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
        defaultValue: { type: 'string', default: '', description: '默认值。' },
        required: {
          type: 'boolean',
          default: false,
          description: '是否必填。',
        },
        multiple: {
          type: 'boolean',
          default: false,
          description: '是否允许多选。',
        },
      },
    },
  },
  {
    name: 'LubanCheckbox',
    category: 'form',
    title: '复选框',
    description: '复选框。',
    props: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '', description: '字段标签。' },
        checked: {
          type: 'boolean',
          default: false,
          description: '是否选中。',
        },
        disabled: {
          type: 'boolean',
          default: false,
          description: '是否禁用。',
        },
      },
    },
  },
  {
    name: 'LubanRadioGroup',
    category: 'form',
    title: '单选框组',
    description: '单选框组。',
    props: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '', description: '字段标签。' },
        options: {
          type: 'array',
          description: '选项数组。',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
            },
          },
        },
        defaultValue: { type: 'string', default: '', description: '默认值。' },
        required: {
          type: 'boolean',
          default: false,
          description: '是否必填。',
        },
      },
    },
  },
  {
    name: 'LubanSwitch',
    category: 'form',
    title: '开关',
    description: '开关切换组件。',
    props: {
      type: 'object',
      properties: {
        label: { type: 'string', default: '', description: '字段标签。' },
        checked: {
          type: 'boolean',
          default: false,
          description: '是否开启。',
        },
        disabled: {
          type: 'boolean',
          default: false,
          description: '是否禁用。',
        },
      },
    },
  },
  // ── data-display ─────────────────────────────────────────────
  {
    name: 'LubanTable',
    category: 'data-display',
    title: '表格',
    description: '数据表格，支持列配置、排序和分页。',
    props: {
      type: 'object',
      properties: {
        columns: {
          type: 'array',
          description: '列定义。',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              title: { type: 'string' },
              dataIndex: { type: 'string' },
              sortable: { type: 'boolean' },
            },
          },
        },
        dataSource: {
          type: 'array',
          description: '数据源。',
        },
        pagination: {
          type: 'boolean',
          default: true,
          description: '是否启用分页。',
        },
        pageSize: {
          type: 'number',
          default: 10,
          description: '每页条数。',
        },
      },
    },
  },
  {
    name: 'LubanCodeBlock',
    category: 'data-display',
    title: '代码块',
    description: '代码展示块，支持语法高亮和复制。',
    props: {
      type: 'object',
      properties: {
        code: { type: 'string', default: '', description: '代码内容。' },
        language: {
          type: 'string',
          default: '',
          description: '编程语言。',
        },
        showLineNumbers: {
          type: 'boolean',
          default: false,
          description: '是否显示行号。',
        },
      },
    },
  },
  // ── navigation ───────────────────────────────────────────────
  {
    name: 'LubanMenu',
    category: 'navigation',
    title: '菜单',
    description: '导航菜单组件。',
    props: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: '菜单项。',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              url: { type: 'string' },
              icon: { type: 'string' },
              children: { type: 'array' },
            },
          },
        },
        mode: {
          type: 'string',
          enum: ['horizontal', 'vertical', 'inline'],
          default: 'horizontal',
          description: '菜单模式。',
        },
      },
    },
  },
  {
    name: 'LubanTabs',
    category: 'navigation',
    title: '标签页',
    description: '标签页切换组件。',
    props: {
      type: 'object',
      properties: {
        tabs: {
          type: 'array',
          description: '标签页定义。',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              key: { type: 'string' },
            },
          },
        },
        defaultActiveKey: {
          type: 'string',
          description: '默认激活标签。',
        },
      },
    },
  },
  {
    name: 'LubanBackToTop',
    category: 'navigation',
    title: '回到顶部',
    description: '回到顶部按钮。',
    props: {
      type: 'object',
      properties: {
        visibilityHeight: {
          type: 'number',
          default: 400,
          description: '滚动至此高度时显示按钮。',
        },
        target: {
          type: 'string',
          default: '',
          description: '滚动容器选择器。',
        },
      },
    },
  },
  // ── feedback ─────────────────────────────────────────────────
  {
    name: 'LubanModal',
    category: 'feedback',
    title: '模态框',
    description: '模态对话框。',
    props: {
      type: 'object',
      properties: {
        title: { type: 'string', default: '', description: '对话框标题。' },
        visible: {
          type: 'boolean',
          default: false,
          description: '是否可见。',
        },
        closable: {
          type: 'boolean',
          default: true,
          description: '是否显示关闭按钮。',
        },
        width: {
          type: 'string',
          default: '520px',
          description: '对话框宽度。',
        },
        footer: {
          type: 'boolean',
          default: true,
          description: '是否显示底部。',
        },
      },
    },
  },
  {
    name: 'LubanDrawer',
    category: 'feedback',
    title: '抽屉',
    description: '抽屉面板，从屏幕边缘滑出。',
    props: {
      type: 'object',
      properties: {
        title: { type: 'string', default: '', description: '抽屉标题。' },
        visible: {
          type: 'boolean',
          default: false,
          description: '是否可见。',
        },
        placement: {
          type: 'string',
          enum: ['left', 'right', 'top', 'bottom'],
          default: 'right',
          description: '抽屉弹出位置。',
        },
        width: {
          type: 'string',
          default: '400px',
          description: '抽屉宽度（左右时）。',
        },
      },
    },
  },
  {
    name: 'LubanToast',
    category: 'feedback',
    title: '轻提示',
    description: '轻量级消息提示。',
    props: {
      type: 'object',
      properties: {
        message: { type: 'string', default: '', description: '提示消息。' },
        type: {
          type: 'string',
          enum: ['success', 'error', 'warning', 'info'],
          default: 'info',
          description: '提示类型。',
        },
        duration: {
          type: 'number',
          default: 3000,
          description: '显示时长（ms）。',
        },
      },
    },
  },
  {
    name: 'LubanAlert',
    category: 'feedback',
    title: '警告提示',
    description: '警告提示组件，展示需要关注的信息。',
    props: {
      type: 'object',
      properties: {
        message: { type: 'string', default: '', description: '提示内容。' },
        type: {
          type: 'string',
          enum: ['success', 'info', 'warning', 'error'],
          default: 'info',
          description: '提示类型。',
        },
        closable: {
          type: 'boolean',
          default: false,
          description: '是否可关闭。',
        },
        showIcon: {
          type: 'boolean',
          default: true,
          description: '是否显示图标。',
        },
      },
    },
  },
  // ── marketing ────────────────────────────────────────────────
  {
    name: 'LubanHero',
    category: 'marketing',
    title: 'Hero 区块',
    description: 'Hero 区块，展示眉标、大标题、副标题、主/次 CTA 与背景图。',
    props: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', default: '欢迎访问', description: '主标题。' },
        subtitle: { type: 'string', default: '', description: '副标题。' },
        eyebrow: {
          type: 'string',
          default: '',
          description: '眉标（标题上方小标签）。',
        },
        ctaText: {
          type: 'string',
          default: '了解更多',
          description: '主按钮文字。',
        },
        ctaUrl: { type: 'string', default: '', description: '主按钮链接。' },
        secondaryCtaText: {
          type: 'string',
          default: '',
          description: '次按钮文字。',
        },
        secondaryCtaUrl: {
          type: 'string',
          default: '',
          description: '次按钮链接。',
        },
        backgroundImage: {
          type: 'string',
          default: '',
          description: '背景图片 URL。',
        },
        backgroundColor: {
          type: 'string',
          default: '#1a1a2e',
          description: '背景色。',
        },
        textColor: {
          type: 'string',
          default: '#ffffff',
          description: '文字颜色。',
        },
        height: { type: 'string', default: '400px', description: '高度。' },
        align: {
          type: 'string',
          enum: ['left', 'center', 'right'],
          default: 'center',
          description: '对齐方式。',
        },
        layout: {
          type: 'string',
          enum: ['centered', 'split'],
          default: 'centered',
          description: '布局模式。',
        },
        sideImage: {
          type: 'string',
          default: '',
          description: 'split 布局右侧图。',
        },
      },
    },
  },
  {
    name: 'LubanCTA',
    category: 'marketing',
    title: '行动号召',
    description: '行动号召区块，突出主按钮引导用户操作。',
    props: {
      type: 'object',
      properties: {
        heading: { type: 'string', default: '', description: '标题。' },
        subheading: { type: 'string', default: '', description: '副标题。' },
        buttonText: {
          type: 'string',
          default: '立即开始',
          description: '按钮文字。',
        },
        buttonUrl: { type: 'string', default: '#', description: '按钮链接。' },
        fullWidth: {
          type: 'boolean',
          default: false,
          description: '是否撑满宽度。',
        },
      },
    },
  },
  {
    name: 'LubanTestimonial',
    category: 'marketing',
    title: '用户证言',
    description: '单条用户证言展示。',
    props: {
      type: 'object',
      properties: {
        quote: { type: 'string', default: '', description: '证言内容。' },
        author: { type: 'string', default: '', description: '作者姓名。' },
        role: { type: 'string', default: '', description: '作者角色/公司。' },
        avatar: { type: 'string', default: '', description: '头像 URL。' },
        rating: {
          type: 'number',
          default: 5,
          description: '评分（1-5）。',
        },
      },
    },
  },
  {
    name: 'LubanLeadCapture',
    category: 'marketing',
    title: '留资表单',
    description: '线索收集表单，用于获取用户联系方式。',
    props: {
      type: 'object',
      properties: {
        heading: { type: 'string', default: '', description: '表单标题。' },
        subheading: {
          type: 'string',
          default: '',
          description: '表单副标题。',
        },
        submitText: {
          type: 'string',
          default: '提交',
          description: '提交按钮文字。',
        },
        showName: {
          type: 'boolean',
          default: true,
          description: '是否显示姓名输入。',
        },
        showEmail: {
          type: 'boolean',
          default: true,
          description: '是否显示邮箱输入。',
        },
        showPhone: {
          type: 'boolean',
          default: false,
          description: '是否显示电话输入。',
        },
      },
    },
  },
  {
    name: 'LubanNavbar',
    category: 'marketing',
    title: '导航栏',
    description: '顶部导航栏，支持品牌标识与链接。',
    props: {
      type: 'object',
      properties: {
        brand: { type: 'string', default: '', description: '品牌名称。' },
        logo: { type: 'string', default: '', description: 'Logo 图片 URL。' },
        links: {
          type: 'array',
          description: '导航链接。',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
        sticky: {
          type: 'boolean',
          default: true,
          description: '是否固定顶部。',
        },
      },
    },
  },
  {
    name: 'LubanFooter',
    category: 'marketing',
    title: '页脚',
    description: '页面底部，支持多列链接和版权信息。',
    props: {
      type: 'object',
      properties: {
        copyright: { type: 'string', default: '', description: '版权信息。' },
        columns: {
          type: 'array',
          description: '链接列。',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              links: { type: 'array' },
            },
          },
        },
      },
    },
  },
  {
    name: 'LubanFeatureGrid',
    category: 'marketing',
    title: '特性网格',
    description: '产品特性展示网格。',
    props: {
      type: 'object',
      properties: {
        heading: { type: 'string', default: '', description: '区块标题。' },
        columns: {
          type: 'number',
          default: 3,
          description: '网格列数。',
        },
        features: {
          type: 'array',
          description: '特性数组。',
          items: {
            type: 'object',
            properties: {
              icon: { type: 'string' },
              title: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'LubanStats',
    category: 'marketing',
    title: '统计数据',
    description: '统计数据展示区块。',
    props: {
      type: 'object',
      properties: {
        stats: {
          type: 'array',
          description: '统计数据。',
          items: {
            type: 'object',
            properties: {
              value: { type: 'string' },
              suffix: { type: 'string' },
              label: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'LubanFAQ',
    category: 'marketing',
    title: '常见问题',
    description: '常见问题折叠面板。',
    props: {
      type: 'object',
      properties: {
        heading: { type: 'string', default: '', description: '区块标题。' },
        items: {
          type: 'array',
          description: '问答项。',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'LubanPricing',
    category: 'marketing',
    title: '定价方案',
    description: '定价方案展示卡片。',
    props: {
      type: 'object',
      properties: {
        heading: { type: 'string', default: '', description: '区块标题。' },
        highlightIndex: {
          type: 'number',
          default: -1,
          description: '高亮方案索引。',
        },
        plans: {
          type: 'array',
          description: '方案列表。',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              price: { type: 'string' },
              period: { type: 'string' },
              features: { type: 'array' },
              ctaText: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'LubanTestimonialCarousel',
    category: 'marketing',
    title: '证言轮播',
    description: '用户证言轮播组件。',
    props: {
      type: 'object',
      properties: {
        testimonials: {
          type: 'array',
          description: '证言列表。',
          items: {
            type: 'object',
            properties: {
              quote: { type: 'string' },
              author: { type: 'string' },
              role: { type: 'string' },
              avatar: { type: 'string' },
              rating: { type: 'number' },
            },
          },
        },
        autoPlay: {
          type: 'boolean',
          default: true,
          description: '是否自动播放。',
        },
        interval: {
          type: 'number',
          default: 5000,
          description: '自动播放间隔（ms）。',
        },
      },
    },
  },
  {
    name: 'LubanGallery',
    category: 'marketing',
    title: '图片画廊',
    description: '图片画廊网格展示。',
    props: {
      type: 'object',
      properties: {
        columns: {
          type: 'number',
          default: 3,
          description: '网格列数。',
        },
        images: {
          type: 'array',
          description: '图片数组。',
          items: {
            type: 'object',
            properties: {
              src: { type: 'string' },
              alt: { type: 'string' },
              caption: { type: 'string' },
            },
          },
        },
      },
    },
  },
  {
    name: 'LubanLogoCloud',
    category: 'marketing',
    title: 'Logo 云',
    description: '客户/合作伙伴 Logo 展示。',
    props: {
      type: 'object',
      properties: {
        heading: { type: 'string', default: '', description: '区块标题。' },
        logos: {
          type: 'array',
          description: 'Logo 列表。',
          items: {
            type: 'object',
            properties: {
              src: { type: 'string' },
              alt: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
      },
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

function buildCatalogJson(): string {
  const grouped: Record<string, { name: string; title: string; description: string }[]> = {};

  for (const m of MATERIALS) {
    const cat = m.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      name: m.name,
      title: m.title,
      description: m.description,
    });
  }

  const catalog = Object.entries(grouped).map(([category, items]) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    count: items.length,
    materials: items,
  }));

  return JSON.stringify(catalog, null, 2);
}

function findMaterial(name: string): MaterialEntry | undefined {
  return MATERIALS.find(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  );
}

// ── Resource definitions ─────────────────────────────────────────────

/** Static resource: full catalog listing (name + category + brief description). */
export const materialCatalogResource: ResourceDef = {
  uri: 'luban://materials/catalog',
  name: '物料目录',
  description: 'Luban 物料完整目录，按分类分组，含名称和简要说明。',
  mimeType: 'application/json',
  load: buildCatalogJson,
};

/**
 * URI template: individual material detail.
 *
 * Usage: luban://materials/LubanHero  →  returns full props schema for LubanHero.
 */
export const materialDetailTemplate: ResourceTemplateDef = {
  uriTemplate: 'luban://materials/{name}',
  name: '物料详情',
  description: '单个物料完整定义，含 props JSON Schema。使用 {name} 占位指定物料名称。',
  mimeType: 'application/json',
  load: (_uri: string, vars: Record<string, string>) => {
    const name = vars.name;
    const material = findMaterial(name);
    if (!material) {
      throw new Error(`Material not found: ${name}`);
    }
    return JSON.stringify(material, null, 2);
  },
};
