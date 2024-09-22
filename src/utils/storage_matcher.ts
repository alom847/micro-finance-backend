export const storageUrlMatcher = (url: string, bucket_name: string) => {
  const regex = `(?<=${bucket_name}\/)[^/]+`;
  const pattern = new RegExp(regex, "g");

  const match = url.match(pattern);

  if (match) {
    return match[0];
  } else {
    return "";
  }
};
