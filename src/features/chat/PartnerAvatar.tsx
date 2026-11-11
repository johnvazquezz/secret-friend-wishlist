import Avatar from '../../components/ui/Avatar';
import { aliasEmoji, partnerLabel, type Conversation } from './api';

const sizes = { sm: 'w-8 h-8 text-base', md: 'w-11 h-11 text-xl' } as const;

interface PartnerAvatarProps {
  conversation: Pick<Conversation, 'partner_name' | 'partner_alias'>;
  url?: string | null;
  size?: keyof typeof sizes;
}

/** Foto de la otra persona o, si es anónima, el emoji de su alias. */
export default function PartnerAvatar({ conversation, url, size = 'md' }: PartnerAvatarProps) {
  if (conversation.partner_name) {
    return <Avatar name={conversation.partner_name} url={url} size={size} />;
  }
  return (
    <span
      role="img"
      aria-label={`Anónimo: ${partnerLabel(conversation)}`}
      className={`${sizes[size]} shrink-0 rounded-full bg-gradient-to-br from-primary-100 to-amber-100 ring-1 ring-primary-200/60 inline-flex items-center justify-center`}
    >
      {aliasEmoji(conversation.partner_alias)}
    </span>
  );
}
