// Translates technical platform errors into plain, human-readable explanations

export interface TranslatedError {
  plainMessage: string
  actionableStep: string
  technicalDetails?: string
}

export function translatePlatformError(platform: string, error: any): TranslatedError {
  const errStr = typeof error === 'string' ? error : JSON.stringify(error)

  // YouTube / Google errors
  if (platform === 'youtube') {
    if (errStr.includes('quotaExceeded')) {
      return {
        plainMessage: 'YouTube daily upload quota reached.',
        actionableStep: 'Google allows approximately 6 video uploads per day on the free unverified tier. Try again tomorrow or request a free quota extension in Google Cloud Console.',
        technicalDetails: errStr,
      }
    }
    if (errStr.includes('invalid_grant') || errStr.includes('Token has been expired or revoked')) {
      return {
        plainMessage: 'YouTube authorization has expired or was revoked.',
        actionableStep: 'Go to the Accounts page and click "Reconnect" to renew access.',
        technicalDetails: errStr,
      }
    }
    if (errStr.includes('uploadLimitExceeded')) {
      return {
        plainMessage: 'Upload rejected by YouTube upload limit.',
        actionableStep: 'Your YouTube account has uploaded too many videos in a short period. Please wait a few hours before retrying.',
        technicalDetails: errStr,
      }
    }
  }

  // Meta (Facebook & Instagram)
  if (platform === 'facebook' || platform === 'instagram') {
    if (errStr.includes('OAuthException') || errStr.includes('Error validating access token')) {
      return {
        plainMessage: 'Meta access pass has expired.',
        actionableStep: 'Please click Reconnect next to your Facebook Page / Instagram account.',
        technicalDetails: errStr,
      }
    }
    if (errStr.includes('Confirm your identity') || errStr.includes('4854002')) {
      return {
        plainMessage: 'Meta security checkpoint: Identity confirmation required.',
        actionableStep: 'Open the Facebook app or notifications on facebook.com to confirm your identity for this Page, then click Retry.',
        technicalDetails: errStr,
      }
    }
    if (errStr.includes('459') || errStr.includes('security check')) {
      return {
        plainMessage: 'Facebook security check required.',
        actionableStep: 'Log in at facebook.com, complete the security check prompt, then click Retry.',
        technicalDetails: errStr,
      }
    }
    if (errStr.includes('Permissions error') || errStr.includes('pages_manage_posts')) {
      return {
        plainMessage: 'Missing posting permissions for this Page.',
        actionableStep: 'Verify that your Facebook profile is an Administrator of the selected Page.',
        technicalDetails: errStr,
      }
    }
    if (errStr.includes('aspect_ratio') || errStr.includes('The image aspect ratio was not valid')) {
      return {
        plainMessage: 'Instagram rejected the image aspect ratio.',
        actionableStep: 'Instagram images must be between 4:5 (portrait) and 1.91:1 (landscape). Crop the photo and retry.',
        technicalDetails: errStr,
      }
    }
  }

  // TikTok
  if (platform === 'tiktok') {
    if (errStr.includes('duration_not_in_range') || errStr.includes('video_duration')) {
      return {
        plainMessage: 'TikTok rejected the video length.',
        actionableStep: 'Videos must be at least 3 seconds and under 10 minutes.',
        technicalDetails: errStr,
      }
    }
    if (errStr.includes('access_token_invalid') || errStr.includes('scope_not_authorized')) {
      return {
        plainMessage: 'TikTok permission expired or scope missing.',
        actionableStep: 'Reconnect your TikTok account and ensure all permission boxes are checked.',
        technicalDetails: errStr,
      }
    }
  }

  // LinkedIn
  if (platform === 'linkedin') {
    if (errStr.includes('EXPIRED_ACCESS_TOKEN') || errStr.includes('token expired')) {
      return {
        plainMessage: 'LinkedIn 60-day connection has expired.',
        actionableStep: 'LinkedIn requires reconnecting every 60 days. Click Reconnect to refresh.',
        technicalDetails: errStr,
      }
    }
    if (errStr.includes('URN')) {
      return {
        plainMessage: 'Invalid LinkedIn profile or organization identifier.',
        actionableStep: 'Check whether the selected profile exists and has permission to post.',
        technicalDetails: errStr,
      }
    }
  }

  // Default fallback
  return {
    plainMessage: `An unexpected issue occurred while publishing to ${platform}.`,
    actionableStep: 'Please review your channel connection and try again.',
    technicalDetails: errStr,
  }
}
