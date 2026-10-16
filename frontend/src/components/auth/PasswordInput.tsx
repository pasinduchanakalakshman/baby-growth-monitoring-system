import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'> & {
  visibilityLabel?: string;
};

export function PasswordInput({ className, disabled, visibilityLabel = 'password', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <LockKeyhole aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-primary" />
      <Input {...props} type={visible ? 'text' : 'password'} disabled={disabled} className={cn('h-12 rounded-lg bg-background/60 pr-12 pl-11', className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-0.5 right-0.5 size-11 rounded-md text-foreground"
        aria-label={`${visible ? 'Hide' : 'Show'} ${visibilityLabel}`}
        aria-pressed={visible}
        aria-controls={props.id}
        disabled={disabled}
        onClick={() => setVisible(value => !value)}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </Button>
    </div>
  );
}
