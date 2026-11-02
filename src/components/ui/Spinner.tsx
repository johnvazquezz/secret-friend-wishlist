interface SpinnerProps {
  label?: string;
}

export default function Spinner({ label = 'Cargando...' }: SpinnerProps) {
  return (
    <div role="status" className="text-center">
      <div
        aria-hidden="true"
        className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4"
      />
      <p className="text-gray-600 text-lg">{label}</p>
    </div>
  );
}
