import SearchableSelect from '@components/ui/SearchableSelect'
import { useMemo } from 'react'

import { buildTimezoneOptions } from '../utils/timezoneOptions'

interface TimezoneSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const TimezoneSelect = ({ value, onChange, disabled }: TimezoneSelectProps) => {
  const options = useMemo(() => buildTimezoneOptions(), [])

  return (
    <SearchableSelect
      label="Timezone"
      value={value}
      onChange={onChange}
      options={options}
      placeholder="Select timezone..."
      searchPlaceholder="Search timezones..."
      disabled={disabled}
      maxHeight={300}
      emptyMessage="No timezone found"
    />
  )
}

export default TimezoneSelect
