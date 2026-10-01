import Button from '@components/ui/Button'
import SearchableSelect from '@components/ui/SearchableSelect'
import { useMemo } from 'react'

import {
  buildTimezoneOptions,
  canonicalTimezone,
  describeTimezone,
  getBrowserTimezone
} from '../utils/timezoneOptions'

interface TimezoneSelectProps {
  value: string
  onChange: (value: string) => void
  wrapperClassName?: string
}

const TimezoneSelect = ({ value, onChange, wrapperClassName }: TimezoneSelectProps) => {
  const options = useMemo(() => buildTimezoneOptions(), [])
  // A zone saved by another browser engine may use the other spelling of the same id.
  const current = canonicalTimezone(value)
  const deviceTimezone = getBrowserTimezone()
  const device = describeTimezone(deviceTimezone)

  return (
    <div className="flex flex-col gap-3">
      <SearchableSelect
        label="Time zone"
        helperText="Quiet hours and email digests use this time zone."
        value={current}
        onChange={onChange}
        options={options}
        placeholder="Select time zone…"
        searchPlaceholder="Search time zones…"
        maxHeight={300}
        emptyMessage="No time zone found."
        optionLabelClassName="tabular-nums"
        wrapperClassName={wrapperClassName}
      />
      {current !== deviceTimezone && (
        <Button variant="quiet" className="self-start" onClick={() => onChange(deviceTimezone)}>
          Use this device&apos;s time zone ({device.offset} {device.city})
        </Button>
      )}
    </div>
  )
}

export default TimezoneSelect
