import motherNewborn from '@/assets/auth/mother-newborn.webp';

type AuthIllustrationProps = {
  src?: string;
  alt?: string;
};

// Original project artwork; provenance is recorded alongside the asset.
// Supply src and alt to replace it independently of the layout and login form.
export function AuthIllustration({ src = motherNewborn, alt = 'A mother gently holding her sleeping baby' }: AuthIllustrationProps) {
  return (
    <div className="aspect-2/3 w-full overflow-hidden">
      <img
        src={src}
        alt={alt}
        width={900}
        height={1125}
        loading="lazy"
        decoding="async"
        className="size-full object-cover object-[90%_center] [mask-image:linear-gradient(to_bottom,black_90%,transparent)]"
      />
    </div>
  );
}
