import { Screen } from '../../components/ui'
import { BuddyFinder } from '../../components/social/BuddyFinder'

export default function Social() {
  return (
    <Screen title="Gym buddies" scroll={false}>
      <BuddyFinder />
    </Screen>
  )
}
