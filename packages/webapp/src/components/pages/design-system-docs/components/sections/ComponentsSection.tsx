/**
 * Components Section
 * ==================
 * Showcases all shared UI components: Button, TextInput, Select, Textarea,
 * FileInput, Checkbox, Toggle, Badge, Card, Modal, Tooltip, Avatar, Loading,
 * Toast, and CopyButton.
 */

import * as toast from '@components/toast'
import {
  Avatar,
  Button,
  Checkbox,
  CopyButton,
  FileInput,
  Select,
  Textarea,
  TextInput,
  Toggle
} from '@components/ui'
import { useState } from 'react'
import {
  MdAccountCircle,
  MdCheck,
  MdCheckBox,
  MdContentCopy,
  MdCreditCard,
  MdEmail,
  MdHourglassEmpty,
  MdInfoOutline,
  MdInput,
  MdLock,
  MdNewReleases,
  MdNotifications,
  MdOpenInNew,
  MdSave,
  MdSearch,
  MdSend,
  MdSettings,
  MdSmartButton,
  MdToggleOn,
  MdUploadFile,
  MdVisibility,
  MdVisibilityOff
} from 'react-icons/md'

import { CodeBlock, ComponentCard, SectionHeader } from '../shared'

export const ComponentsSection = () => {
  const [showLoadingDemo, setShowLoadingDemo] = useState(false)
  const [buttonLoading, setButtonLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="space-y-16">
      {/* ==================== BUTTONS ==================== */}
      <section id="buttons">
        <SectionHeader
          id="buttons-header"
          title="Button Component"
          description="Shared Button component with variants, sizes, icons, and loading states"
          icon={MdSmartButton}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Button Variants"
            description="Use the appropriate variant based on action importance"
            code={`import { Button } from '@components/ui'

<Button variant="primary">Primary</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="accent">Accent</Button>
<Button variant="neutral">Neutral</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>`}
            importStatement="import { Button } from '@components/ui'"
            useWhen={[
              'Primary action (Submit, Save, Create)',
              'Secondary actions',
              'Cancel or back actions'
            ]}
            avoidWhen={['Links that navigate (use <a>)', 'Too many primary buttons on one page']}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="neutral">Neutral</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </ComponentCard>

          <ComponentCard
            title="Button Sizes"
            code={`<Button size="xs" variant="primary">Tiny</Button>
<Button size="sm" variant="primary">Small</Button>
<Button size="md" variant="primary">Medium</Button>
<Button size="lg" variant="primary">Large</Button>
<Button size="xl" variant="primary">Extra Large</Button>`}>
            <Button size="xs" variant="primary">
              Tiny
            </Button>
            <Button size="sm" variant="primary">
              Small
            </Button>
            <Button size="md" variant="primary">
              Medium
            </Button>
            <Button size="lg" variant="primary">
              Large
            </Button>
            <Button size="xl" variant="primary">
              Extra Large
            </Button>
          </ComponentCard>

          <ComponentCard
            title="Button Styles (Outline, Soft, Dash)"
            code={`<Button variant="primary" btnStyle="outline">Outline</Button>
<Button variant="primary" btnStyle="soft">Soft</Button>
<Button variant="primary" btnStyle="dash">Dash</Button>`}>
            <Button variant="primary" btnStyle="outline">
              Outline
            </Button>
            <Button variant="primary" btnStyle="soft">
              Soft
            </Button>
            <Button variant="primary" btnStyle="dash">
              Dash
            </Button>
            <Button variant="error" btnStyle="outline">
              Error Outline
            </Button>
            <Button variant="success" btnStyle="soft">
              Success Soft
            </Button>
          </ComponentCard>

          <ComponentCard
            title="Semantic Buttons"
            description="Use for status-specific actions"
            code={`<Button variant="success" size="sm">Success</Button>
<Button variant="warning" size="sm">Warning</Button>
<Button variant="error" size="sm">Error</Button>
<Button variant="info" size="sm">Info</Button>`}>
            <Button variant="success" size="sm">
              Success
            </Button>
            <Button variant="warning" size="sm">
              Warning
            </Button>
            <Button variant="error" size="sm">
              Error
            </Button>
            <Button variant="info" size="sm">
              Info
            </Button>
          </ComponentCard>

          <ComponentCard
            title="Buttons with Icons"
            code={`<Button variant="primary" startIcon={MdSave}>Save</Button>
<Button variant="neutral" endIcon={MdSend}>Send</Button>
<Button variant="ghost" shape="circle" startIcon={MdSettings} />`}
            importStatement="import { MdSave, MdSend, MdSettings } from 'react-icons/md'">
            <Button variant="primary" startIcon={MdSave}>
              Save
            </Button>
            <Button variant="neutral" endIcon={MdSend}>
              Send
            </Button>
            <Button variant="ghost" shape="circle" startIcon={MdSettings} />
            <Button variant="primary" shape="circle" startIcon={MdNotifications} />
            <Button variant="neutral" btnStyle="outline" shape="circle" startIcon={MdOpenInNew} />
          </ComponentCard>

          <ComponentCard
            title="Loading State"
            description="Click to toggle loading state"
            code={`<Button loading>Loading...</Button>
<Button loading loadingText="Saving...">Save</Button>`}>
            <Button
              variant="primary"
              loading={buttonLoading}
              loadingText="Saving..."
              onClick={() => {
                setButtonLoading(true)
                setTimeout(() => setButtonLoading(false), 2000)
              }}>
              {buttonLoading ? 'Saving...' : 'Click to Load'}
            </Button>
            <Button loading variant="secondary">
              Loading
            </Button>
            <Button loading loadingText="Processing..." variant="accent">
              Process
            </Button>
          </ComponentCard>

          <ComponentCard
            title="Button Shapes"
            code={`<Button shape="wide" variant="primary">Wide</Button>
<Button shape="block" variant="secondary">Block (Full Width)</Button>
<Button shape="square" variant="ghost" startIcon={MdSettings} />
<Button shape="circle" variant="primary" startIcon={MdCheck} />`}>
            <Button shape="wide" variant="primary">
              Wide Button
            </Button>
            <Button shape="square" variant="ghost" startIcon={MdSettings} />
            <Button shape="circle" variant="primary" startIcon={MdCheck} />
          </ComponentCard>
        </div>
      </section>

      {/* ==================== TEXT INPUT ==================== */}
      <section id="inputs">
        <SectionHeader
          id="inputs-header"
          title="TextInput Component"
          description="Text input with label positions, icons, and validation states"
          icon={MdInput}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Basic TextInput"
            code={`import { TextInput } from '@components/ui'

<TextInput placeholder="Enter your name" />
<TextInput label="Email" labelPosition="above" placeholder="you@example.com" />`}
            importStatement="import { TextInput } from '@components/ui'">
            <TextInput placeholder="Enter your name" wrapperClassName="max-w-xs" />
            <TextInput
              label="Email"
              labelPosition="above"
              placeholder="you@example.com"
              wrapperClassName="max-w-xs"
            />
          </ComponentCard>

          <ComponentCard
            title="Label Positions"
            description="inside (inline), floating, or above"
            code={`<TextInput label="Name" labelPosition="inside" placeholder="Type here..." />
<TextInput label="Email" labelPosition="floating" />
<TextInput label="Username" labelPosition="above" placeholder="@username" />`}>
            <TextInput
              label="Name"
              labelPosition="inside"
              placeholder="Type here..."
              wrapperClassName="max-w-xs"
            />
            <TextInput label="Email" labelPosition="floating" wrapperClassName="max-w-xs" />
            <TextInput
              label="Username"
              labelPosition="above"
              placeholder="@username"
              wrapperClassName="max-w-xs"
            />
          </ComponentCard>

          <ComponentCard
            title="Input Sizes"
            code={`<TextInput size="xs" placeholder="Extra small" />
<TextInput size="sm" placeholder="Small" />
<TextInput size="md" placeholder="Medium (default)" />
<TextInput size="lg" placeholder="Large" />`}>
            <TextInput size="xs" placeholder="Extra small" wrapperClassName="max-w-xs" />
            <TextInput size="sm" placeholder="Small" wrapperClassName="max-w-xs" />
            <TextInput size="md" placeholder="Medium" wrapperClassName="max-w-xs" />
            <TextInput size="lg" placeholder="Large" wrapperClassName="max-w-xs" />
          </ComponentCard>

          <ComponentCard
            title="Input with Icons"
            code={`<TextInput startIcon={MdSearch} placeholder="Search..." />
<TextInput startIcon={MdEmail} label="Email" labelPosition="above" />
<TextInput
  startIcon={MdLock}
  endIcon={showPassword ? MdVisibility : MdVisibilityOff}
  type={showPassword ? 'text' : 'password'}
  placeholder="Password"
/>`}
            importStatement="import { MdSearch, MdEmail, MdLock } from 'react-icons/md'">
            <TextInput startIcon={MdSearch} placeholder="Search..." wrapperClassName="max-w-xs" />
            <TextInput
              startIcon={MdEmail}
              label="Email"
              labelPosition="above"
              placeholder="you@example.com"
              wrapperClassName="max-w-xs"
            />
            <div className="w-full max-w-xs">
              <TextInput
                startIcon={MdLock}
                endIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="hover:text-primary">
                    {showPassword ? <MdVisibility size={18} /> : <MdVisibilityOff size={18} />}
                  </button>
                }
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
              />
            </div>
          </ComponentCard>

          <ComponentCard
            title="Validation States"
            code={`<TextInput error helperText="This field is required" placeholder="Error state" />
<TextInput success helperText="Username is available" placeholder="Success state" />`}>
            <TextInput
              error
              helperText="This field is required"
              placeholder="Error state"
              wrapperClassName="max-w-xs"
            />
            <TextInput
              success
              helperText="Username is available"
              placeholder="Success state"
              wrapperClassName="max-w-xs"
            />
          </ComponentCard>

          <ComponentCard
            title="Color Variants"
            code={`<TextInput color="primary" placeholder="Primary" />
<TextInput color="secondary" placeholder="Secondary" />
<TextInput color="accent" placeholder="Accent" />`}>
            <TextInput color="primary" placeholder="Primary" wrapperClassName="max-w-xs" />
            <TextInput color="secondary" placeholder="Secondary" wrapperClassName="max-w-xs" />
            <TextInput color="accent" placeholder="Accent" wrapperClassName="max-w-xs" />
          </ComponentCard>
        </div>
      </section>

      {/* ==================== SELECT ==================== */}
      <section id="select">
        <SectionHeader
          id="select-header"
          title="Select Component"
          description="Dropdown select with options, label positions, and validation"
          icon={MdInput}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Basic Select"
            code={`import { Select } from '@components/ui'

<Select
  label="Country"
  placeholder="Select a country"
  options={[
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' }
  ]}
/>`}
            importStatement="import { Select } from '@components/ui'">
            <Select
              label="Country"
              labelPosition="above"
              placeholder="Select a country"
              options={[
                { value: 'us', label: 'United States' },
                { value: 'uk', label: 'United Kingdom' },
                { value: 'ca', label: 'Canada' }
              ]}
              wrapperClassName="max-w-xs"
            />
          </ComponentCard>

          <ComponentCard
            title="Select Sizes"
            code={`<Select size="xs" options={options} />
<Select size="sm" options={options} />
<Select size="md" options={options} />
<Select size="lg" options={options} />`}>
            <Select
              size="xs"
              placeholder="Extra small"
              options={[{ value: '1', label: 'Option 1' }]}
              wrapperClassName="max-w-xs"
            />
            <Select
              size="sm"
              placeholder="Small"
              options={[{ value: '1', label: 'Option 1' }]}
              wrapperClassName="max-w-xs"
            />
            <Select
              size="md"
              placeholder="Medium"
              options={[{ value: '1', label: 'Option 1' }]}
              wrapperClassName="max-w-xs"
            />
            <Select
              size="lg"
              placeholder="Large"
              options={[{ value: '1', label: 'Option 1' }]}
              wrapperClassName="max-w-xs"
            />
          </ComponentCard>

          <ComponentCard
            title="Floating Label Select"
            code={`<Select label="Category" labelPosition="floating" options={options} />`}>
            <Select
              label="Category"
              labelPosition="floating"
              options={[
                { value: 'tech', label: 'Technology' },
                { value: 'design', label: 'Design' },
                { value: 'marketing', label: 'Marketing' }
              ]}
              wrapperClassName="max-w-xs"
            />
          </ComponentCard>

          <ComponentCard
            title="Select Validation States"
            code={`<Select error helperText="Please select an option" />
<Select success helperText="Great choice!" />`}>
            <Select
              error
              helperText="Please select an option"
              placeholder="Error state"
              options={[]}
              wrapperClassName="max-w-xs"
            />
            <Select
              success
              helperText="Great choice!"
              placeholder="Success state"
              options={[]}
              wrapperClassName="max-w-xs"
            />
          </ComponentCard>
        </div>
      </section>

      {/* ==================== TEXTAREA ==================== */}
      <section id="textarea">
        <SectionHeader
          id="textarea-header"
          title="Textarea Component"
          description="Multi-line text input with label positions and validation"
          icon={MdInput}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Basic Textarea"
            code={`import { Textarea } from '@components/ui'

<Textarea label="Description" labelPosition="above" placeholder="Enter description..." />
<Textarea label="Bio" labelPosition="floating" rows={4} />`}
            importStatement="import { Textarea } from '@components/ui'">
            <Textarea
              label="Description"
              labelPosition="above"
              placeholder="Enter description..."
              wrapperClassName="max-w-sm"
            />
            <Textarea label="Bio" labelPosition="floating" rows={3} wrapperClassName="max-w-sm" />
          </ComponentCard>

          <ComponentCard
            title="Textarea Sizes"
            code={`<Textarea size="sm" placeholder="Small" />
<Textarea size="md" placeholder="Medium" />
<Textarea size="lg" placeholder="Large" />`}>
            <Textarea size="sm" placeholder="Small textarea" rows={2} wrapperClassName="max-w-sm" />
            <Textarea
              size="md"
              placeholder="Medium textarea"
              rows={2}
              wrapperClassName="max-w-sm"
            />
            <Textarea size="lg" placeholder="Large textarea" rows={2} wrapperClassName="max-w-sm" />
          </ComponentCard>

          <ComponentCard
            title="Textarea Validation"
            code={`<Textarea error helperText="Description is required" />
<Textarea success helperText="Looks good!" />`}>
            <Textarea
              error
              helperText="Description is required"
              placeholder="Error state"
              wrapperClassName="max-w-sm"
            />
            <Textarea
              success
              helperText="Looks good!"
              placeholder="Success state"
              wrapperClassName="max-w-sm"
            />
          </ComponentCard>
        </div>
      </section>

      {/* ==================== FILE INPUT ==================== */}
      <section id="file-input">
        <SectionHeader
          id="file-input-header"
          title="FileInput Component"
          description="File upload input with validation states"
          icon={MdUploadFile}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Basic FileInput"
            code={`import { FileInput } from '@components/ui'

<FileInput label="Upload file" />
<FileInput label="Profile photo" helperText="Max 5MB, JPG or PNG" />`}
            importStatement="import { FileInput } from '@components/ui'">
            <FileInput label="Upload file" wrapperClassName="max-w-sm" />
            <FileInput
              label="Profile photo"
              helperText="Max 5MB, JPG or PNG"
              wrapperClassName="max-w-sm"
            />
          </ComponentCard>

          <ComponentCard
            title="FileInput Sizes"
            code={`<FileInput size="xs" />
<FileInput size="sm" />
<FileInput size="md" />
<FileInput size="lg" />`}>
            <FileInput size="xs" wrapperClassName="max-w-xs" />
            <FileInput size="sm" wrapperClassName="max-w-xs" />
            <FileInput size="md" wrapperClassName="max-w-xs" />
            <FileInput size="lg" wrapperClassName="max-w-xs" />
          </ComponentCard>

          <ComponentCard
            title="FileInput Color Variants"
            code={`<FileInput color="primary" />
<FileInput color="secondary" />
<FileInput color="accent" />`}>
            <FileInput color="primary" wrapperClassName="max-w-xs" />
            <FileInput color="secondary" wrapperClassName="max-w-xs" />
            <FileInput color="accent" wrapperClassName="max-w-xs" />
          </ComponentCard>
        </div>
      </section>

      {/* ==================== CHECKBOX ==================== */}
      <section id="checkbox">
        <SectionHeader
          id="checkbox-header"
          title="Checkbox Component"
          description="Checkbox with label, sizes, and color variants"
          icon={MdCheckBox}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Basic Checkbox"
            code={`import { Checkbox } from '@components/ui'

<Checkbox label="I agree to the terms" />
<Checkbox label="Subscribe to newsletter" defaultChecked />`}
            importStatement="import { Checkbox } from '@components/ui'">
            <Checkbox label="I agree to the terms" />
            <Checkbox label="Subscribe to newsletter" defaultChecked />
          </ComponentCard>

          <ComponentCard
            title="Checkbox Sizes"
            code={`<Checkbox size="xs" label="Extra small" />
<Checkbox size="sm" label="Small" />
<Checkbox size="md" label="Medium" />
<Checkbox size="lg" label="Large" />`}>
            <Checkbox size="xs" label="Extra small" defaultChecked />
            <Checkbox size="sm" label="Small" defaultChecked />
            <Checkbox size="md" label="Medium" defaultChecked />
            <Checkbox size="lg" label="Large" defaultChecked />
          </ComponentCard>

          <ComponentCard
            title="Checkbox Colors"
            code={`<Checkbox color="primary" label="Primary" />
<Checkbox color="secondary" label="Secondary" />
<Checkbox color="success" label="Success" />
<Checkbox color="warning" label="Warning" />
<Checkbox color="error" label="Error" />`}>
            <Checkbox color="primary" label="Primary" defaultChecked />
            <Checkbox color="secondary" label="Secondary" defaultChecked />
            <Checkbox color="success" label="Success" defaultChecked />
            <Checkbox color="warning" label="Warning" defaultChecked />
            <Checkbox color="error" label="Error" defaultChecked />
          </ComponentCard>

          <ComponentCard
            title="Checkbox with Helper Text"
            code={`<Checkbox label="Remember me" helperText="Keep me signed in on this device" />`}>
            <Checkbox label="Remember me" helperText="Keep me signed in on this device" />
          </ComponentCard>
        </div>
      </section>

      {/* ==================== TOGGLE ==================== */}
      <section id="toggle">
        <SectionHeader
          id="toggle-header"
          title="Toggle Component"
          description="Toggle switch with label, sizes, and color variants"
          icon={MdToggleOn}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Basic Toggle"
            code={`import { Toggle } from '@components/ui'

<Toggle />
<Toggle label="Enable notifications" />
<Toggle label="Dark mode" defaultChecked />`}
            importStatement="import { Toggle } from '@components/ui'">
            <Toggle />
            <Toggle label="Enable notifications" />
            <Toggle label="Dark mode" defaultChecked />
          </ComponentCard>

          <ComponentCard
            title="Toggle Sizes"
            code={`<Toggle size="xs" label="Extra small" />
<Toggle size="sm" label="Small" />
<Toggle size="md" label="Medium" />
<Toggle size="lg" label="Large" />`}>
            <Toggle size="xs" label="Extra small" defaultChecked />
            <Toggle size="sm" label="Small" defaultChecked />
            <Toggle size="md" label="Medium" defaultChecked />
            <Toggle size="lg" label="Large" defaultChecked />
          </ComponentCard>

          <ComponentCard
            title="Toggle Variants"
            code={`<Toggle variant="primary" label="Primary" />
<Toggle variant="secondary" label="Secondary" />
<Toggle variant="success" label="Success" />
<Toggle variant="warning" label="Warning" />
<Toggle variant="error" label="Error" />`}>
            <Toggle variant="primary" label="Primary" defaultChecked />
            <Toggle variant="secondary" label="Secondary" defaultChecked />
            <Toggle variant="success" label="Success" defaultChecked />
            <Toggle variant="warning" label="Warning" defaultChecked />
            <Toggle variant="error" label="Error" defaultChecked />
          </ComponentCard>

          <ComponentCard
            title="Toggle with Helper Text"
            code={`<Toggle label="Auto-save" helperText="Automatically save changes every 5 minutes" />`}>
            <Toggle
              label="Auto-save"
              helperText="Automatically save changes every 5 minutes"
              defaultChecked
            />
          </ComponentCard>
        </div>
      </section>

      {/* ==================== BADGES & ALERTS ==================== */}
      <section id="badges-alerts">
        <SectionHeader
          id="badges-alerts-header"
          title="Badges & Alerts"
          description="Status indicators and feedback messages"
          icon={MdNewReleases}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Badges"
            code={`<span className="badge">Default</span>
<span className="badge badge-primary">Primary</span>
<span className="badge badge-secondary">Secondary</span>
<span className="badge badge-outline">Outline</span>`}>
            <span className="badge">Default</span>
            <span className="badge badge-primary">Primary</span>
            <span className="badge badge-secondary">Secondary</span>
            <span className="badge badge-accent">Accent</span>
            <span className="badge badge-outline">Outline</span>
          </ComponentCard>

          <ComponentCard
            title="Semantic Badges"
            code={`<span className="badge badge-info">Info</span>
<span className="badge badge-success">Success</span>
<span className="badge badge-warning">Warning</span>
<span className="badge badge-error">Error</span>`}>
            <span className="badge badge-info">Info</span>
            <span className="badge badge-success">Success</span>
            <span className="badge badge-warning">Warning</span>
            <span className="badge badge-error">Error</span>
          </ComponentCard>

          <ComponentCard
            title="Alerts"
            code={`<div role="alert" className="alert alert-info">
  <span>Info message</span>
</div>`}>
            <div className="w-full space-y-2">
              <div role="alert" className="alert alert-info py-2">
                <span className="text-sm">ℹ️ Info: New features available!</span>
              </div>
              <div role="alert" className="alert alert-success py-2">
                <span className="text-sm">✓ Success: Changes saved.</span>
              </div>
              <div role="alert" className="alert alert-warning py-2">
                <span className="text-sm">⚠️ Warning: Review required.</span>
              </div>
              <div role="alert" className="alert alert-error py-2">
                <span className="text-sm">✗ Error: Something went wrong.</span>
              </div>
            </div>
          </ComponentCard>
        </div>
      </section>

      {/* ==================== CARDS ==================== */}
      <section id="cards">
        <SectionHeader
          id="cards-header"
          title="Cards"
          description="Content containers with optional actions"
          icon={MdCreditCard}
        />

        <ComponentCard
          title="Card Styles"
          code={`// Standard card
<div className="rounded-2xl bg-white p-4 shadow-xl shadow-slate-200/50 sm:p-8">

// Bordered card
<div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">

// Inset card
<div className="rounded-xl bg-slate-50 p-4 sm:p-6">`}>
          <div className="grid w-full gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 shadow-xl shadow-slate-200/50">
              <p className="font-medium text-slate-800">Standard Card</p>
              <p className="text-sm text-slate-500">With shadow</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="font-medium text-slate-800">Bordered Card</p>
              <p className="text-sm text-slate-500">With border</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-medium text-slate-800">Inset Card</p>
              <p className="text-sm text-slate-500">Subtle background</p>
            </div>
            <div className="card border-base-300 bg-base-100 border shadow-sm">
              <div className="card-body p-4">
                <p className="font-medium text-slate-800">daisyUI Card</p>
                <p className="text-sm text-slate-500">Using card class</p>
              </div>
            </div>
          </div>
        </ComponentCard>
      </section>

      {/* ==================== MODALS ==================== */}
      <section id="modals">
        <SectionHeader
          id="modals-header"
          title="Modals & Dialogs"
          description="Overlay dialogs for focused interactions"
          icon={MdOpenInNew}
        />

        <div className="space-y-6">
          <CodeBlock
            title="Modal Pattern"
            code={`import { Modal } from '@components/ui/Dialog'

<Modal id="my-modal" isOpen={isOpen} setIsOpen={setIsOpen}>
  <div className="p-6">
    <h2 className="text-lg font-bold">Modal Title</h2>
    <p className="mt-2 text-slate-600">Modal content...</p>
    <div className="mt-4 flex justify-end gap-2">
      <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button variant="primary">Confirm</Button>
    </div>
  </div>
</Modal>`}
          />

          <div className="rounded-xl bg-blue-50 p-4">
            <h4 className="mb-2 font-semibold text-blue-800">💡 Modal Best Practices</h4>
            <ul className="space-y-1 text-sm text-blue-700">
              <li>
                • Use{' '}
                <code className="rounded bg-blue-100 px-1">bg-slate-900/40 backdrop-blur-sm</code>{' '}
                for backdrop
              </li>
              <li>• Always provide close button, ESC key, and backdrop click</li>
              <li>• Max widths: sm (384px), md (448px), lg (512px), xl (576px)</li>
              <li>
                • Use <code className="rounded bg-blue-100 px-1">rounded-2xl</code> for modal
                content
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ==================== TOOLTIPS & DROPDOWNS ==================== */}
      <section id="tooltips-dropdowns">
        <SectionHeader
          id="tooltips-dropdowns-header"
          title="Tooltips & Dropdowns"
          description="Contextual overlays and menus"
          icon={MdInfoOutline}
        />

        <ComponentCard
          title="Tooltips"
          code={`<div className="tooltip" data-tip="Hello!">
  <button className="btn">Hover me</button>
</div>`}>
          <div className="tooltip" data-tip="Hello!">
            <button className="btn btn-sm">Hover me</button>
          </div>
          <div className="tooltip tooltip-primary" data-tip="Primary styled">
            <button className="btn btn-primary btn-sm">Primary</button>
          </div>
          <div className="tooltip tooltip-bottom" data-tip="Bottom tooltip">
            <button className="btn btn-sm">Bottom</button>
          </div>
        </ComponentCard>

        <div className="mt-6">
          <CodeBlock
            title="Dropdown Pattern"
            code={`<details className="dropdown">
  <summary className="btn btn-sm m-1">Click</summary>
  <ul className="menu dropdown-content z-20 w-52 rounded-box bg-base-100 p-2 shadow">
    <li><a>Item 1</a></li>
    <li><a>Item 2</a></li>
  </ul>
</details>`}
          />
        </div>
      </section>

      {/* ==================== AVATAR ==================== */}
      <section id="avatar">
        <SectionHeader
          id="avatar-header"
          title="Avatar & Presence"
          description="User profile images with status indicators"
          icon={MdAccountCircle}
        />

        <ComponentCard
          title="Avatar Sizes"
          description="Use semantic size presets"
          code={`import { Avatar } from '@components/ui/Avatar'

<Avatar id={userId} size="xs" />  // 24px
<Avatar id={userId} size="sm" />  // 32px
<Avatar id={userId} size="md" />  // 40px
<Avatar id={userId} size="lg" />  // 48px
<Avatar id={userId} size="xl" />  // 56px`}
          importStatement="import { Avatar } from '@components/ui/Avatar'">
          <Avatar id="demo-xs" size="xs" clickable={false} />
          <Avatar id="demo-sm" size="sm" clickable={false} />
          <Avatar id="demo-md" size="md" clickable={false} />
          <Avatar id="demo-lg" size="lg" clickable={false} />
          <Avatar id="demo-xl" size="xl" clickable={false} />
        </ComponentCard>

        <div className="mt-6">
          <ComponentCard
            title="Avatar with Presence"
            code={`<Avatar id={userId} displayPresence online size="md" />`}
            importStatement="import { Avatar } from '@components/ui/Avatar'">
            <Avatar id="demo-online" displayPresence online size="md" clickable={false} />
            <Avatar id="demo-offline" displayPresence online={false} size="md" clickable={false} />
          </ComponentCard>
        </div>
      </section>

      {/* ==================== LOADING ==================== */}
      <section id="loading">
        <SectionHeader
          id="loading-header"
          title="Loading States"
          description="Spinners, skeletons, and progress indicators"
          icon={MdHourglassEmpty}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Loading Spinners"
            description="Click to demo - animations off by default to save CPU"
            code={`<span className="loading loading-spinner loading-sm" />
<span className="loading loading-dots loading-md" />
<span className="loading loading-ring loading-lg" />`}>
            <button
              onClick={() => setShowLoadingDemo(!showLoadingDemo)}
              className={`btn btn-sm ${showLoadingDemo ? 'btn-error' : 'btn-primary'}`}>
              {showLoadingDemo ? 'Stop Demo' : 'Start Demo'}
            </button>
            {showLoadingDemo && (
              <>
                <span className="loading loading-spinner loading-sm text-primary" />
                <span className="loading loading-dots loading-md text-secondary" />
                <span className="loading loading-ring loading-md text-accent" />
                <span className="loading loading-bars loading-md text-info" />
              </>
            )}
          </ComponentCard>

          <ComponentCard
            title="Skeleton Loaders"
            code={`<div className="skeleton h-4 w-full" />
<div className="skeleton h-4 w-4/5" />
<div className="skeleton h-4 w-3/5" />`}>
            <div className="w-full space-y-2">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-4/5" />
              <div className="skeleton h-4 w-3/5" />
            </div>
          </ComponentCard>

          <CodeBlock
            title="Loading Toast Pattern"
            code={`import * as toast from '@components/toast'

const toastId = toast.Loading('Saving...')
// Later:
toast.dismiss(toastId)
// Or replace:
toast.Success('Done!', { id: toastId })`}
          />
        </div>
      </section>

      {/* ==================== TOAST NOTIFICATIONS ==================== */}
      <section id="toasts">
        <SectionHeader
          id="toasts-header"
          title="Toast Notifications"
          description="Theme-aware toasts with colored indicator bars (Figma-style)"
          icon={MdNotifications}
        />

        <div className="space-y-6">
          <ComponentCard
            title="Toast Variants"
            description="Click to preview each toast type"
            code={`import * as toast from '@components/toast'

toast.Success('Document saved')
toast.Error('Failed to save')
toast.Info('New features available')
toast.Warning('Unsaved changes')
toast.Neutral('Message sent')`}
            importStatement="import * as toast from '@components/toast'">
            <button
              className="btn btn-success btn-sm"
              onClick={() => toast.Success('Document saved successfully')}>
              Success
            </button>
            <button
              className="btn btn-error btn-sm"
              onClick={() => toast.Error('Failed to save document')}>
              Error
            </button>
            <button
              className="btn btn-info btn-sm"
              onClick={() => toast.Info('New features are available')}>
              Info
            </button>
            <button
              className="btn btn-warning btn-sm"
              onClick={() => toast.Warning('You have unsaved changes')}>
              Warning
            </button>
            <button
              className="btn btn-neutral btn-sm"
              onClick={() => toast.Neutral('Message sent')}>
              Neutral
            </button>
          </ComponentCard>

          <ComponentCard
            title="Toast with Icons"
            description="Pass any React node as content"
            code={`toast.Success(
  <span className="flex items-center gap-2">
    <MdCheck /> Saved successfully
  </span>
)`}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                toast.Success(
                  <span className="flex items-center gap-2">
                    <MdCheck /> Saved successfully
                  </span>
                )
              }>
              Toast with Icon
            </button>
          </ComponentCard>

          <ComponentCard
            title="Toast with Action Button"
            description="Add undo/action buttons for destructive operations"
            code={`toast.Error('Item deleted', {
  actionLabel: 'Undo',
  onAction: () => restoreItem()
})`}>
            <button
              className="btn btn-error btn-sm"
              onClick={() =>
                toast.Error('Item deleted', {
                  actionLabel: 'Undo',
                  onAction: () => toast.Success('Item restored')
                })
              }>
              Delete with Undo
            </button>
          </ComponentCard>

          <ComponentCard
            title="Loading Toast"
            description="Persistent until dismissed"
            code={`const toastId = toast.Loading('Processing...')
// Later:
toast.dismiss(toastId)`}>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                const toastId = toast.Loading('Processing...')
                setTimeout(() => {
                  toast.Success('Done!', { id: toastId })
                }, 2000)
              }}>
              Show Loading Toast
            </button>
          </ComponentCard>

          <div className="rounded-xl bg-blue-50 p-4">
            <h4 className="mb-2 font-semibold text-blue-800">💡 Toast Design</h4>
            <ul className="space-y-1 text-sm text-blue-700">
              <li>
                • <strong>Theme-aware:</strong> Dark toast on light backgrounds, light toast on dark
                backgrounds
              </li>
              <li>
                • <strong>Colored indicator:</strong> Vertical pill on left (green/red/blue/orange)
              </li>
              <li>
                • <strong>Dynamic content:</strong> Pass text, icons, or any React node
              </li>
              <li>
                • <strong>Action buttons:</strong> Use for undo/retry operations
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ==================== COPY BUTTON ==================== */}
      <section id="copy-button">
        <SectionHeader
          id="copy-button-header"
          title="CopyButton Component"
          description="Animated copy-to-clipboard with visual feedback"
          icon={MdContentCopy}
        />

        <div className="space-y-6">
          <ComponentCard
            title="CopyButton Component"
            description="GitHub-style animated copy button"
            code={`import { CopyButton } from '@components/ui'

<CopyButton text="Hello World" />
<CopyButton text={code} label="Copy" successLabel="Copied!" />
<CopyButton text={url} size="sm" variant="primary" />`}
            importStatement="import { CopyButton } from '@components/ui'">
            <CopyButton text="Hello World" />
            <CopyButton text="With label" label="Copy" successLabel="Copied!" />
            <CopyButton text="Primary" variant="primary" />
          </ComponentCard>

          <ComponentCard
            title="CopyButton Sizes"
            code={`<CopyButton text={url} size="xs" />
<CopyButton text={url} size="sm" />
<CopyButton text={url} size="md" />
<CopyButton text={url} size="lg" />`}>
            <CopyButton text="xs" size="xs" />
            <CopyButton text="sm" size="sm" />
            <CopyButton text="md" size="md" />
            <CopyButton text="lg" size="lg" />
          </ComponentCard>

          <CodeBlock
            title="useCopyToClipboard Hook"
            code={`import useCopyToClipboard from '@hooks/useCopyToClipboard'

const { copy, copied, copying } = useCopyToClipboard({
  successMessage: 'Link copied!',
  resetDelay: 2000
})

await copy(text)
{copied && <MdCheck className="text-success" />}`}
          />

          <div className="rounded-xl bg-blue-50 p-4">
            <h4 className="mb-2 font-semibold text-blue-800">💡 Copy Architecture</h4>
            <ul className="space-y-1 text-sm text-blue-700">
              <li>
                • <code className="rounded bg-blue-100 px-1">CopyButton</code> - For copy buttons
                with built-in animation
              </li>
              <li>
                • <code className="rounded bg-blue-100 px-1">useCopyToClipboard</code> - Hook for
                custom React components
              </li>
              <li>
                • <code className="rounded bg-blue-100 px-1">copyToClipboard</code> - Utility for
                non-React contexts
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
